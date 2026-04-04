import { Price } from '@domain/models/primitives/price';
import { Decimal } from '@domain/models/primitives/decimal';
import { OrderSide } from '@domain/models/order/order-side';
import { GridLevel } from './grid-level';

/**
 * Grid Levels Calculator Service
 *
 * Calculates grid levels and order sizes for SPOT grid trading.
 *
 * ## How we calculate:
 *
 * ### 1. Grid Levels Distribution
 * Grid is divided into N equal gaps between lower and upper bounds, producing N+1 price points:
 * ```
 * priceStep = (upperPrice - lowerPrice) / levels
 * levelPrice[i] = lowerPrice + (priceStep * i),  i = 0 .. levels
 * ```
 *
 * ### 2. Order Side Determination
 * Each level is assigned buy or sell based on current market price:
 * ```
 * if (levelPrice < currentPrice):
 *     side = Buy   (place buy orders below current price)
 * else:
 *     side = Sell  (place sell orders above current price)
 * ```
 *
 * ### 3. Capital Distribution
 * Capital is distributed EQUALLY across all levels of same side:
 *
 * **Buy Orders (below current price):**
 * ```
 * quotePerLevel = totalInvestmentQuote / buyLevelsCount
 * amountUSDC = quotePerLevel           (USDC to spend)
 * amountBase = quotePerLevel / price    (tokens to receive)
 * ```
 *
 * **Sell Orders (above current price):**
 * Base tokens are distributed equally. This gives equal notional at CURRENT price
 * (which is what the exchange uses to validate minimum order value):
 * ```
 * basePerLevel = totalInvestmentBase / sellLevelsCount
 * amountBase = basePerLevel                (tokens to sell, same for all sell levels)
 * amountUSDC = basePerLevel * price        (USDC to receive, varies by level price)
 * ```
 */
export class GridLevelsCalculatorService {
    constructor(private readonly minOrderNotional: number) {}

    calculateLevelsWithSizes(
        lowerPrice: number,
        upperPrice: number,
        levels: number,
        investmentUSDC: number,
        investmentBase: number,
        currentPrice: Price,
    ): GridLevel[] {
        const totalInvestmentUSDC = investmentUSDC + investmentBase * currentPrice.toNumber();
        const gridLevels = this.calculateLevels(lowerPrice, upperPrice, levels, currentPrice);
        const levelsWithSizes = this.calculateOrderSizes(
            investmentUSDC,
            investmentBase,
            gridLevels,
        );
        this.validateMinOrderNotional(levelsWithSizes, totalInvestmentUSDC, currentPrice);
        return levelsWithSizes;
    }

    private validateMinOrderNotional(
        levels: GridLevel[],
        totalInvestmentUSDC: number,
        currentPrice: Price,
    ): void {
        // Exchange validates order notional at current market price, not limit price.
        // For buy levels: amountBase * currentPrice > amountUSDC (current > limitPrice) — passes easier.
        // For sell levels: amountBase * currentPrice < amountUSDC (current < limitPrice) — stricter check.
        const minNotionalAtCurrentPrice = levels
            .filter((l) => l.amountBase !== undefined)
            .reduce((min, l) => Math.min(min, l.amountBase! * currentPrice.toNumber()), Infinity);

        if (minNotionalAtCurrentPrice < this.minOrderNotional) {
            const minRequiredUSDC = Math.ceil(
                totalInvestmentUSDC * (this.minOrderNotional / minNotionalAtCurrentPrice),
            );
            throw new Error(
                `Order notional value $${minNotionalAtCurrentPrice.toFixed(2)} per level is below minimum $${this.minOrderNotional.toFixed(2)}. Minimum investment for current configuration: $${minRequiredUSDC}. Increase investment or reduce number of levels.`,
            );
        }
    }

    private getLevelPrice(
        lowerPrice: number,
        upperPrice: number,
        levels: number,
        levelIndex: number,
    ): Price {
        const priceStep = (upperPrice - lowerPrice) / levels;
        return Price.from(lowerPrice + priceStep * levelIndex);
    }

    private calculateLevels(
        lowerPrice: number,
        upperPrice: number,
        levels: number,
        currentPrice: Price,
    ): GridLevel[] {
        const result: GridLevel[] = [];

        for (let i = 0; i <= levels; i++) {
            const levelPrice = this.getLevelPrice(lowerPrice, upperPrice, levels, i);
            const isBelowCurrentPrice = levelPrice.lt(currentPrice);

            result.push({
                index: i,
                price: levelPrice,
                side: isBelowCurrentPrice ? OrderSide.Buy : OrderSide.Sell,
            });
        }

        return result;
    }

    private calculateOrderSizes(
        investmentUSDC: number,
        investmentBase: number,
        levels: GridLevel[],
    ): GridLevel[] {
        const buyLevels = levels.filter((l) => l.side === OrderSide.Buy);
        const sellLevels = levels.filter((l) => l.side === OrderSide.Sell);

        const quotePerBuyLevel = Decimal.from(investmentUSDC).div(Decimal.from(buyLevels.length));
        const basePerSellLevel = Decimal.from(investmentBase).div(Decimal.from(sellLevels.length));

        return levels.map((level) => {
            if (level.side === OrderSide.Buy) {
                return {
                    ...level,
                    amountUSDC: quotePerBuyLevel.toNumber(),
                    amountBase: quotePerBuyLevel
                        .div(Decimal.from(level.price.toNumber()))
                        .toNumber(),
                };
            } else {
                return {
                    ...level,
                    amountBase: basePerSellLevel.toNumber(),
                    amountUSDC: basePerSellLevel
                        .mul(Decimal.from(level.price.toNumber()))
                        .toNumber(),
                };
            }
        });
    }
}
