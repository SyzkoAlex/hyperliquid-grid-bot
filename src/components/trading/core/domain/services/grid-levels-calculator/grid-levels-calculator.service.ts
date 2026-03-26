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
 * Grid is divided into equal price levels between lower and upper bounds:
 * ```
 * priceStep = (upperPrice - lowerPrice) / (levels - 1)
 * levelPrice[i] = lowerPrice + (priceStep * i)
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
 * To ensure equal notional (USDC value) per level, we use the harmonic mean:
 * ```
 * usdcPerLevel = investmentBase / Σ(1/price_i)   (constant USDC notional per level)
 * amountBase_i = usdcPerLevel / price_i           (varies by price)
 * amountUSDC   = usdcPerLevel                     (same for all sell levels)
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
        const gridLevels = this.calculateLevels(lowerPrice, upperPrice, levels, currentPrice);
        const levelsWithSizes = this.calculateOrderSizes(
            investmentUSDC,
            investmentBase,
            gridLevels,
        );
        this.validateMinOrderNotional(levelsWithSizes);
        return levelsWithSizes;
    }

    private validateMinOrderNotional(levels: GridLevel[]): void {
        for (const level of levels) {
            if (level.amountUSDC === undefined) {
                continue;
            }
            if (level.amountUSDC < this.minOrderNotional) {
                throw new Error(
                    `Order notional value $${level.amountUSDC.toFixed(2)} at level ${level.index} is below minimum $${this.minOrderNotional.toFixed(2)}. Increase investment or reduce number of levels.`,
                );
            }
        }
    }

    private getLevelPrice(
        lowerPrice: number,
        upperPrice: number,
        levels: number,
        levelIndex: number,
    ): Price {
        const priceStep = (upperPrice - lowerPrice) / (levels - 1);
        return Price.from(lowerPrice + priceStep * levelIndex);
    }

    private calculateLevels(
        lowerPrice: number,
        upperPrice: number,
        levels: number,
        currentPrice: Price,
    ): GridLevel[] {
        const result: GridLevel[] = [];

        for (let i = 0; i < levels; i++) {
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

        // Equal USDC notional per sell level via harmonic distribution:
        // usdcPerSellLevel = investmentBase / Σ(1/price_i)
        const sumInvPrices = sellLevels.reduce(
            (sum, level) => sum.add(Decimal.from(1).div(Decimal.from(level.price.toNumber()))),
            Decimal.from(0),
        );
        const usdcPerSellLevel = Decimal.from(investmentBase).div(sumInvPrices);

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
                    amountBase: usdcPerSellLevel
                        .div(Decimal.from(level.price.toNumber()))
                        .toNumber(),
                    amountUSDC: usdcPerSellLevel.toNumber(),
                };
            }
        });
    }
}
