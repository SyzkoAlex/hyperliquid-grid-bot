import { Injectable } from '@nestjs/common';
import { Decimal } from '@domain/models/primitives/decimal';
import { CapitalDistribution } from '../../models/capital-distribution';
import { Price } from '@domain/models/primitives/price';
import { countBuySellLevels } from '../../utils/count-buy-sell-levels';

function ceilToSzDecimals(value: number, szDecimals: number): number {
    const multiplier = Math.pow(10, szDecimals);
    return Math.ceil(value * multiplier) / multiplier;
}

function floorToSzDecimals(value: number, szDecimals: number): number {
    const multiplier = Math.pow(10, szDecimals);
    return Math.floor(value * multiplier) / multiplier;
}

/**
 * Capital Calculator Service
 *
 * Calculates capital distribution for SPOT grid trading using geometry-based distribution.
 *
 * ## How we calculate:
 *
 * ### 1. Total Investment Estimation (if not provided)
 * If totalInvestmentUSDC is not specified, we calculate it from user's balance:
 * ```
 * totalValue = usdcBalance + (baseBalance * currentPrice)
 * ```
 *
 * ### 2. Geometry-Based Distribution
 *
 * The grid produces N+1 price levels across [lowerPrice, upperPrice].
 * Each level is classified as a buy (price < currentPrice) or sell (price >= currentPrice).
 * Capital is allocated proportionally so every order has equal USDC notional at current price:
 *
 * ```
 * priceStep = (upperPrice - lowerPrice) / levels
 * buyCount  = count of levelPrices < currentPrice
 * sellCount = count of levelPrices >= currentPrice
 * totalLevels = levels + 1
 *
 * investmentUSDC = totalInvestment * buyCount / totalLevels
 * investmentBase = totalInvestment * sellCount / totalLevels / currentPrice
 * ```
 *
 * ### Example (BTC, price $50,000, range $45,000-$55,000, 10 levels):
 * ```
 * priceStep = 1000
 * levelPrices: 45k, 46k, 47k, 48k, 49k, 50k, 51k, 52k, 53k, 54k, 55k (11 total)
 * buyCount = 5 (45k..49k < 50000), sellCount = 6 (50k..55k >= 50000)
 *
 * investmentUSDC = 10,000 * 5/11 ~= 4,545.45 USDC (for buy orders)
 * investmentBase = 10,000 * 6/11 / 50,000 ~= 0.10909 BTC (for sell orders)
 * ```
 *
 * The returned `requiredUSDC` equals this `investmentUSDC`. The returned `requiredBase` equals
 * this `investmentBase` after buffering and ceil-rounding per sell order.
 */
@Injectable()
export class CapitalCalculatorService {
    /**
     * Calculate capital distribution for grid trading
     *
     * @param params.levels - Number of grid levels; the grid creates levels+1 price points
     * @param params.totalInvestmentUSDC - Optional total investment amount in USDC. If not provided, calculated from balance
     * @param params.usdcBalance - User's available USDC balance
     * @param params.baseBalance - User's available base token balance
     * @param params.currentPrice - Current market price (used for accurate base token conversion)
     * @param params.lowerPrice - Grid lower price bound
     * @param params.upperPrice - Grid upper price bound
     * @param params.sellSizeBuffer - Buffer fraction added to each sell order during placement (e.g. 0.005 = 0.5%)
     * @param params.szDecimals - Exchange size-decimals for the base token; used to mirror per-order ceil-rounding in requiredBase
     * @returns Capital distribution with:
     *          - requiredUSDC: raw buy notional
     *          - requiredBase: sellCount × ceil(rawInvestmentBase/sellCount × (1+sellSizeBuffer), szDecimals)
     *          - rawInvestmentBase: un-buffered intermediate base allocation; used for grid persistence,
     *            stripped at the API adapter boundary so external consumers never see it
     */
    calculateDistribution(params: {
        levels: number;
        totalInvestmentUSDC?: number;
        usdcBalance: Decimal;
        baseBalance: Decimal;
        currentPrice: Price;
        lowerPrice: number;
        upperPrice: number;
        sellSizeBuffer: number;
        szDecimals: number;
    }): CapitalDistribution {
        const capital = params.totalInvestmentUSDC
            ? Decimal.from(params.totalInvestmentUSDC)
            : this.convertPortfolioToUSDC(
                  params.usdcBalance,
                  params.baseBalance,
                  params.currentPrice,
              );

        const { buyLevels: buyCount, sellLevels: sellCount } = countBuySellLevels(
            params.levels,
            params.lowerPrice,
            params.upperPrice,
            params.currentPrice.toNumber(),
        );

        const totalLevels = params.levels + 1;
        const buyRatio = buyCount / totalLevels;
        const sellRatio = sellCount / totalLevels;

        const requiredUSDC = capital.mul(Decimal.from(buyRatio));
        const investmentBase = capital
            .mul(Decimal.from(sellRatio))
            .div(Decimal.from(params.currentPrice.toNumber()));

        let requiredBase: Decimal;
        if (sellCount === 0) {
            requiredBase = Decimal.zero();
        } else {
            const basePerSellLevel = investmentBase
                .div(Decimal.from(sellCount))
                .mul(Decimal.from(1 + params.sellSizeBuffer))
                .toNumber();
            const effectivePerSellLevel = ceilToSzDecimals(basePerSellLevel, params.szDecimals);
            requiredBase = Decimal.from(effectivePerSellLevel).mul(Decimal.from(sellCount));
        }

        return { requiredUSDC, requiredBase, rawInvestmentBase: investmentBase };
    }

    /**
     * Calculate the maximum total investment given available balances.
     *
     * Uses a tight analytical upper bound as starting point, then walks down by $1 until
     * calculateDistribution confirms the candidate fits within both balances.
     * This guarantees consistency with calculateDistribution regardless of any future
     * transformations (buffer, ceil-rounding, fee adjustments, etc.).
     *
     * Starting bound derivation (base-constrained side):
     *   max T such that ceil(T×sellRatio/price/sellCount×(1+buffer), szDecimals)×sellCount ≤ baseBalance
     *   → T ≤ floor(baseBalance/sellCount, szDecimals) × price × totalLevels / (1+buffer)
     * This bound is tight: the walk-down typically completes in 0–2 iterations regardless of szDecimals.
     *
     * @param params.levels - Number of grid levels; the grid creates levels+1 price points
     * @param params.usdcBalance - User's available USDC balance
     * @param params.baseBalance - User's available base token balance
     * @param params.currentPrice - Current market price
     * @param params.lowerPrice - Grid lower price bound
     * @param params.upperPrice - Grid upper price bound
     * @param params.sellSizeBuffer - Buffer fraction added to each sell order (e.g. 0.005 = 0.5%)
     * @param params.szDecimals - Exchange size-decimals for the base token
     * @returns Maximum safe investment in USDC, floored to whole dollars
     */
    calculateMaxInvestment(params: {
        usdcBalance: Decimal;
        baseBalance: Decimal;
        currentPrice: Price;
        lowerPrice: number;
        upperPrice: number;
        levels: number;
        sellSizeBuffer: number;
        szDecimals: number;
    }): number {
        const { buyLevels: buyCount, sellLevels: sellCount } = countBuySellLevels(
            params.levels,
            params.lowerPrice,
            params.upperPrice,
            params.currentPrice.toNumber(),
        );
        const totalLevels = params.levels + 1;
        const buyRatio = buyCount / totalLevels;
        const price = params.currentPrice.toNumber();

        const maxFromUsdc =
            buyRatio > 0 ? params.usdcBalance.div(Decimal.from(buyRatio)).toNumber() : Infinity;

        // Tight upper bound for the base-constrained side using floor per sell level,
        // ensuring ceil-rounding in calculateDistribution cannot push requiredBase above baseBalance.
        const maxFromBase =
            sellCount > 0
                ? (floorToSzDecimals(
                      params.baseBalance.div(Decimal.from(sellCount)).toNumber(),
                      params.szDecimals,
                  ) *
                      price *
                      totalLevels) /
                  (1 + params.sellSizeBuffer)
                : Infinity;

        let candidate = Math.floor(Math.min(maxFromUsdc, maxFromBase));

        // Walk down until calculateDistribution confirms the candidate fits both balances.
        // The tight starting bound makes this converge in 0–2 iterations in practice.
        // Guaranteed to terminate: candidate=0 always passes (requiredUSDC=0, requiredBase=0).
        while (candidate > 0) {
            const dist = this.calculateDistribution({
                levels: params.levels,
                totalInvestmentUSDC: candidate,
                usdcBalance: params.usdcBalance,
                baseBalance: params.baseBalance,
                currentPrice: params.currentPrice,
                lowerPrice: params.lowerPrice,
                upperPrice: params.upperPrice,
                sellSizeBuffer: params.sellSizeBuffer,
                szDecimals: params.szDecimals,
            });

            if (
                dist.requiredUSDC.lte(params.usdcBalance) &&
                dist.requiredBase.lte(params.baseBalance)
            ) {
                return candidate;
            }
            candidate--;
        }

        return 0;
    }

    /**
     * Convert user's portfolio (USDC + base tokens) to total USDC value
     *
     * Used to auto-calculate investment amount when user doesn't specify it.
     * Takes current USDC balance and base token balance, converts everything to USDC.
     *
     * Formula: portfolioValueUSDC = usdcBalance + (baseBalance * currentPrice)
     *
     * Example: User has 5,000 USDC and 0.1 BTC, BTC current price = 50,000
     * portfolioValueUSDC = 5,000 + (0.1 * 50,000) = 10,000 USDC
     *
     * @param usdcBalance - User's USDC balance
     * @param baseBalance - User's base token balance (e.g., BTC, ETH)
     * @param currentPrice - Current market price from exchange
     * @returns Total portfolio value in USDC
     */
    private convertPortfolioToUSDC(
        usdcBalance: Decimal,
        baseBalance: Decimal,
        currentPrice: Price,
    ): Decimal {
        const baseValueInUSDC = baseBalance.mul(Decimal.from(currentPrice.toNumber()));
        return usdcBalance.add(baseValueInUSDC);
    }
}
