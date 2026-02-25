import { GridDto } from '@/components/grids/api/dto/grid.dto';
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
 * ```
 * basePerLevel = totalInvestmentBase / sellLevelsCount
 * amountBase = basePerLevel             (tokens to sell)
 * amountUSDC = basePerLevel * price    (USDC to receive)
 * ```
 */
export class GridLevelsCalculatorService {
    constructor(private readonly minOrderNotional: number) {}

    /**
     * Calculate grid levels with order sizes
     *
     * @param grid - Grid DTO with configuration
     * @param currentPrice - Current market price from exchange
     * @returns Array of levels with prices, sides, and order sizes
     */
    calculateLevelsWithSizes(grid: GridDto, currentPrice: Price): GridLevel[] {
        const levels = this.calculateLevels(grid, currentPrice);
        const levelsWithSizes = this.calculateOrderSizes(grid, levels);
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
                    `Order notional value $${level.amountUSDC.toFixed(2)} at level ${level.index} is below minimum $${this.minOrderNotional}. Increase investment or reduce number of levels.`,
                );
            }
        }
    }

    private getLevelPrice(grid: GridDto, levelIndex: number): Price {
        const priceStep = (grid.upperPrice - grid.lowerPrice) / (grid.levels - 1);
        return Price.from(grid.lowerPrice + priceStep * levelIndex);
    }

    private calculateLevels(grid: GridDto, currentPrice: Price): GridLevel[] {
        const levels: GridLevel[] = [];

        for (let i = 0; i < grid.levels; i++) {
            const levelPrice = this.getLevelPrice(grid, i);
            const isBelowCurrentPrice = levelPrice.lt(currentPrice);

            levels.push({
                index: i,
                price: levelPrice,
                side: isBelowCurrentPrice ? OrderSide.Buy : OrderSide.Sell,
            });
        }

        return levels;
    }

    private calculateOrderSizes(grid: GridDto, levels: GridLevel[]): GridLevel[] {
        const buyLevels = levels.filter((l) => l.side === OrderSide.Buy);
        const sellLevels = levels.filter((l) => l.side === OrderSide.Sell);

        const quotePerBuyLevel = Decimal.from(grid.investmentUSDC).div(
            Decimal.from(buyLevels.length),
        );
        const basePerSellLevel = Decimal.from(grid.investmentBase).div(
            Decimal.from(sellLevels.length),
        );

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
