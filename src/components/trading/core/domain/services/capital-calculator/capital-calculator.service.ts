import { Injectable } from '@nestjs/common';
import { Decimal } from '@domain/models/primitives/decimal';
import { CapitalDistribution } from '../../models/capital-distribution';
import { Price } from '@domain/models/primitives/price';
import { countBuySellLevels } from '../../utils/count-buy-sell-levels';

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
     * @returns Capital distribution: how much USDC and base tokens to use
     */
    calculateDistribution(params: {
        levels: number;
        totalInvestmentUSDC?: number;
        usdcBalance: Decimal;
        baseBalance: Decimal;
        currentPrice: Price;
        lowerPrice: number;
        upperPrice: number;
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

        const investmentUSDC = capital.mul(Decimal.from(buyRatio));
        const investmentBase = capital
            .mul(Decimal.from(sellRatio))
            .div(Decimal.from(params.currentPrice.toNumber()));

        return { investmentUSDC, investmentBase };
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
