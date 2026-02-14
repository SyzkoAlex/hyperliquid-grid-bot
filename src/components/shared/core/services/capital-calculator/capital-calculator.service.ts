import { Injectable } from '@nestjs/common';
import { Decimal } from '../../../../../domain/primitives/decimal';
import { logger } from '../../../../../infra/logger/logger';
import { CapitalDistribution } from '@domain/capital-distribution';
import { GridMode } from '@domain/grid/grid-mode';
import { Price } from '@domain/primitives/price';

/**
 * Capital Calculator Service
 *
 * Calculates capital distribution for SPOT grid trading.
 *
 * ## How we calculate:
 *
 * ### 1. Total Investment Estimation (if not provided)
 * If totalInvestmentUSDC is not specified, we calculate it from user's balance:
 * ```
 * totalValue = usdcBalance + (baseBalance * currentPrice)
 * ```
 *
 * ### 2. Distribution by Mode (GridMode enum)
 *
 * **Why we use currentPrice:**
 * - We fetch the current market price from the exchange
 * - This gives us accurate conversion between USD and token quantity
 * - More precise than using grid range midpoint approximation
 *
 * **GridMode.Neutral (50/50):**
 * - Best for sideways/ranging markets
 * - Equal exposure to USDC and base token
 * ```
 * investmentUSDC = totalInvestmentUSDC * 0.5  (USDC for buy orders)
 * investmentBase = totalInvestmentUSDC * 0.5 / currentPrice  (tokens for sell orders)
 * ```
 * The division by price converts USD value to token quantity.
 *
 * **GridMode.Long (30/70):**
 * - Best for bullish markets
 * - Higher exposure to base token
 * ```
 * investmentUSDC = totalInvestmentUSDC * 0.3  (USDC for buy orders)
 * investmentBase = totalInvestmentUSDC * 0.7 / currentPrice  (tokens for sell orders)
 * ```
 * The division by price converts USD value to token quantity.
 *
 * ### 3. Balance Adjustment
 * If user has insufficient base tokens, we use available balance:
 * ```
 * if (availableBase < requiredBase):
 *     investmentBase = availableBase  (use all available tokens)
 *     investmentUSDC = unchanged      (keep USDC allocation)
 * ```
 *
 * This ensures grid can start even with partial balance.
 *
 * ### Example (GridMode.Neutral, BTC):
 * ```
 * totalInvestmentUSDC = 10,000 USDC
 * currentPrice = 50,000 USDC (from exchange)
 *
 * investmentUSDC = 10,000 * 0.5 = 5,000 USDC
 * investmentBase = 10,000 * 0.5 / 50,000 = 0.1 BTC
 *
 * Grid will place:
 * - Buy orders using 5,000 USDC
 * - Sell orders using 0.1 BTC
 * ```
 */
@Injectable()
export class CapitalCalculatorService {
    private readonly logger = logger.child({ context: CapitalCalculatorService.name });

    private readonly NEUTRAL_USDC_RATIO = 0.5;
    private readonly NEUTRAL_BASE_RATIO = 0.5;
    private readonly LONG_USDC_RATIO = 0.3;
    private readonly LONG_BASE_RATIO = 0.7;

    /**
     * Calculate capital distribution for grid trading
     *
     * @param params.mode - Trading mode: Neutral (50/50) or Long (30/70)
     * @param params.totalInvestmentUSDC - Optional total investment amount in USDC. If not provided, calculated from balance
     * @param params.usdcBalance - User's available USDC balance
     * @param params.baseBalance - User's available base token balance
     * @param params.currentPrice - Current market price (used for accurate base token conversion)
     * @param params.lowerPrice - Grid lower price bound
     * @param params.upperPrice - Grid upper price bound
     * @returns Capital distribution: how much USDC and base tokens to use
     */
    calculateDistribution(params: {
        mode: GridMode;
        totalInvestmentUSDC?: number;
        usdcBalance: Decimal;
        baseBalance: Decimal;
        currentPrice: Price;
        lowerPrice: number;
        upperPrice: number;
    }): CapitalDistribution {
        const totalInvestmentUSDC = params.totalInvestmentUSDC
            ? Decimal.from(params.totalInvestmentUSDC)
            : this.convertPortfolioToUSDC(
                  params.usdcBalance,
                  params.baseBalance,
                  params.currentPrice,
              );

        if (!params.totalInvestmentUSDC) {
            this.logger.info(
                { totalInvestmentUSDC: totalInvestmentUSDC.toString() },
                'Auto-calculated total investment USDC',
            );
        }

        const result = this.calculate({
            mode: params.mode,
            capital: totalInvestmentUSDC,
            availableBase: params.baseBalance,
            currentPrice: params.currentPrice,
        });

        this.logger.info(
            {
                mode: params.mode,
                totalInvestmentUSDC: totalInvestmentUSDC.toString(),
                investmentUSDC: result.investmentUSDC.toString(),
                investmentBase: result.investmentBase.toString(),
            },
            'Capital distribution calculated',
        );

        return result;
    }

    private calculate(params: {
        mode: GridMode;
        capital: Decimal;
        availableBase: Decimal;
        currentPrice: Price;
    }): CapitalDistribution {
        if (params.mode === GridMode.Neutral) {
            return this.calculateNeutral(params.capital, params.availableBase, params.currentPrice);
        } else if (params.mode === GridMode.Long) {
            return this.calculateLong(params.capital, params.availableBase, params.currentPrice);
        } else {
            throw new Error(
                `Invalid mode: ${params.mode}. Available: ${GridMode.Neutral}, ${GridMode.Long}`,
            );
        }
    }

    /**
     * Calculate Neutral Mode distribution (50/50)
     *
     * Example: capital = 10,000 USDC, currentPrice = 50,000 USDC
     * - investmentUSDC = 5,000 USDC (for buy orders below current price)
     * - investmentBase = 0.1 BTC (for sell orders above current price)
     */
    private calculateNeutral(
        capital: Decimal,
        availableBase: Decimal,
        currentPrice: Price,
    ): CapitalDistribution {
        const investmentUSDC = capital.mul(Decimal.from(this.NEUTRAL_USDC_RATIO));
        const investmentBase = capital
            .mul(Decimal.from(this.NEUTRAL_BASE_RATIO))
            .div(Decimal.from(currentPrice.toNumber()));

        return this.adjustForAvailableBalance(investmentUSDC, investmentBase, availableBase);
    }

    /**
     * Calculate Long Mode distribution (30/70)
     *
     * More base tokens = more exposure to price growth
     *
     * Example: capital = 10,000 USDC, currentPrice = 50,000 USDC
     * - investmentUSDC = 3,000 USDC (for buy orders)
     * - investmentBase = 0.14 BTC (for sell orders)
     */
    private calculateLong(
        capital: Decimal,
        availableBase: Decimal,
        currentPrice: Price,
    ): CapitalDistribution {
        const investmentUSDC = capital.mul(Decimal.from(this.LONG_USDC_RATIO));
        const investmentBase = capital
            .mul(Decimal.from(this.LONG_BASE_RATIO))
            .div(Decimal.from(currentPrice.toNumber()));

        return this.adjustForAvailableBalance(investmentUSDC, investmentBase, availableBase);
    }

    /**
     * Adjust distribution if user has insufficient base token balance
     *
     * If user doesn't have enough base tokens:
     * - Use all available base tokens (instead of calculated amount)
     * - Keep USDC allocation unchanged
     *
     * Example: Need 0.1 BTC, but user has only 0.05 BTC
     * - investmentBase = 0.05 BTC (use all available)
     * - investmentUSDC = unchanged
     *
     * This allows grid to start with partial balance,
     * but sell-side will have fewer orders.
     */
    private adjustForAvailableBalance(
        investmentUSDC: Decimal,
        investmentBase: Decimal,
        availableBase: Decimal,
    ): CapitalDistribution {
        // Check if user has enough base tokens
        if (availableBase.lt(investmentBase)) {
            this.logger.warn(
                {
                    required: investmentBase.toString(),
                    available: availableBase.toString(),
                },
                'Insufficient base tokens, using available balance',
            );
            return {
                investmentUSDC,
                investmentBase: availableBase, // Use all available tokens
            };
        }

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
