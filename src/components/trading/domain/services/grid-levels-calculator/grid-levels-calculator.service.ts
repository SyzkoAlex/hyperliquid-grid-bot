import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Grid } from '@domain/models/grid/grid';
import { Price } from '@domain/models/primitives/price';
import { Decimal } from '../../../../../domain/models/primitives/decimal';
import { logger } from '../../../../../infra/logger/logger';
import { Config } from '../../../../../infra/config/config.schema';
import { GridLevel } from './grid-level';
import { OrderSide } from '@domain/models/order/order-side';

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
 * Each level is assigned buy or sell based on grid mid-point (center of range):
 * ```
 * gridMidPoint = (lowerPrice + upperPrice) / 2
 * if (levelPrice < gridMidPoint):
 *     side = BUY   (place buy orders below grid center)
 * else:
 *     side = SELL  (place sell orders above grid center)
 * ```
 *
 * IMPORTANT: We use grid mid-point, NOT current market price. This ensures
 * symmetric distribution of orders regardless of current market conditions.
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
 *
 * ### Example (BTC, 10 levels):
 * ```
 * Range: 45,000 - 55,000 USDC
 * Grid mid-point: 50,000 USDC (center of range)
 * Investment: 5,000 USDC + 0.1 BTC
 *
 * Step 1: Calculate price levels
 * priceStep = (55,000 - 45,000) / 9 = 1,111.11
 * levels = [45,000, 46,111, 47,222, 48,333, 49,444,
 *           50,556, 51,667, 52,778, 53,889, 55,000]
 *
 * Step 2: Determine sides (grid mid-point = 50,000)
 * Buy levels:  45,000, 46,111, 47,222, 48,333, 49,444 (5 levels)
 * Sell levels: 50,556, 51,667, 52,778, 53,889, 55,000 (5 levels)
 *
 * Step 3: Distribute capital
 * Buy orders:  5,000 USDC / 5 = 1,000 USDC per level
 *   @ 45,000: buy 0.0222 BTC for 1,000 USDC
 *   @ 46,111: buy 0.0217 BTC for 1,000 USDC
 *   ...
 *
 * Sell orders: 0.1 BTC / 5 = 0.02 BTC per level
 *   @ 50,556: sell 0.02 BTC for 1,011 USDC
 *   @ 51,667: sell 0.02 BTC for 1,033 USDC
 *   ...
 * ```
 *
 * ### Key Points:
 * - Equal USDC amount per buy level (more tokens at lower prices)
 * - Equal token amount per sell level (more USDC at higher prices)
 * - Grid mid-point determines buy/sell split (NOT current market price)
 * - This creates symmetric distribution regardless of market conditions
 * - If price moves, some orders execute and grid rebalances
 */
@Injectable()
export class GridLevelsCalculatorService {
    private readonly logger = logger.child({ context: GridLevelsCalculatorService.name });
    private readonly minOrderNotional: number;

    constructor(private readonly configService: ConfigService<Config, true>) {
        this.minOrderNotional = this.configService.get('hyperliquid', {
            infer: true,
        }).minOrderNotional;
    }

    /**
     * Calculate grid levels with order sizes
     *
     * Main entry point that orchestrates level calculation:
     * 1. Calculate price levels and determine buy/sell sides based on current market price
     * 2. Calculate order sizes for each level
     *
     * IMPORTANT: This method uses the CURRENT MARKET PRICE as the reference price to split
     * buy/sell orders. This is critical for proper capital distribution:
     *
     * Example: Range 70-100, current price = 72
     * - Levels below 72 → BUY orders (need USDT reserved)
     * - Levels at/above 72 → SELL orders (need base tokens held)
     *
     * Capital distribution is determined by where the current price sits in the range:
     * - Current price near bottom → Most capital in base tokens (many sell orders above)
     * - Current price near top → Most capital in USDT (many buy orders below)
     * - Current price in middle → Balanced split
     *
     * See SPOT_GRID_TRADING_ALGORITHM.md for detailed capital distribution logic.
     *
     * @param grid - Grid configuration (bounds, investment amounts)
     * @param currentPrice - Current market price from exchange
     * @returns Array of levels with prices, sides, and order sizes
     */
    calculateLevelsWithSizes(grid: Grid, currentPrice: Price): GridLevel[] {
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

    /**
     * Calculate grid levels and assign buy/sell sides
     *
     * Divides price range into equal levels and determines order side
     * based on current market price.
     *
     * Example: 10 levels, range 45k-55k, current price 48k
     * - Levels below 48k → BUY orders (accumulate on dips)
     * - Levels at/above 48k → SELL orders (take profit on rises)
     *
     * Price calculation done by grid.getLevelPrice() which uses:
     * priceStep = (upperPrice - lowerPrice) / (levels - 1)
     * levelPrice[i] = lowerPrice + (priceStep * i)
     *
     * @param currentPrice - Current market price from exchange
     */
    private calculateLevels(grid: Grid, currentPrice: Price): GridLevel[] {
        const levels: GridLevel[] = [];

        for (let i = 0; i < grid.levels; i++) {
            // Get price for this level (calculated by Grid entity)
            const levelPrice = grid.getLevelPrice(i);

            // Determine if this level is below current market price
            const isBelowCurrentPrice = levelPrice.lt(currentPrice);

            if (isBelowCurrentPrice) {
                // Below current price → place BUY order
                // Will execute if price drops to this level
                levels.push({
                    index: i,
                    price: levelPrice,
                    side: OrderSide.Buy,
                });
            } else {
                // At or above current price → place SELL order
                // Will execute if price rises to this level or is already there
                levels.push({
                    index: i,
                    price: levelPrice,
                    side: OrderSide.Sell,
                });
            }
        }

        this.logger.info(
            {
                symbol: grid.symbol.toString(),
                totalLevels: levels.length,
                buyLevels: levels.filter((l) => l.side === OrderSide.Buy).length,
                sellLevels: levels.filter((l) => l.side === OrderSide.Sell).length,
            },
            'Grid levels calculated',
        );

        return levels;
    }

    /**
     * Calculate order sizes for each grid level
     *
     * Distributes capital EQUALLY across all levels of the same side.
     *
     * ## Buy Orders (below current price):
     * - Split total USDC investment equally
     * - Each level gets: totalInvestmentQuote / buyLevelsCount
     * - Token amount varies by price (more tokens at lower prices)
     *
     * Example: 5,000 USDC across 5 buy levels
     * - Each level: 1,000 USDC
     * - @ 45,000: buy 0.0222 BTC
     * - @ 47,000: buy 0.0213 BTC (less tokens, same USDC)
     *
     * ## Sell Orders (above current price):
     * - Split total token investment equally
     * - Each level gets: totalInvestmentBase / sellLevelsCount
     * - USDC amount varies by price (more USDC at higher prices)
     *
     * Example: 0.1 BTC across 5 sell levels
     * - Each level: 0.02 BTC
     * - @ 51,000: sell for 1,020 USDC
     * - @ 53,000: sell for 1,060 USDC (more USDC, same tokens)
     *
     * This creates a natural rebalancing effect:
     * - Buy more when price is lower
     * - Earn more when price is higher
     */
    private calculateOrderSizes(grid: Grid, levels: GridLevel[]): GridLevel[] {
        // Separate levels by side
        const buyLevels = levels.filter((l) => l.side === OrderSide.Buy);
        const sellLevels = levels.filter((l) => l.side === OrderSide.Sell);

        // Calculate USDC per buy level (equal USDC distribution)
        const quotePerBuyLevel = grid.investmentUSDC.div(Decimal.from(buyLevels.length));

        // Calculate tokens per sell level (equal token distribution)
        const basePerSellLevel = grid.investmentBase.div(Decimal.from(sellLevels.length));

        return levels.map((level) => {
            switch (level.side) {
                case OrderSide.Buy:
                    // BUY order: spend fixed USDC, receive variable tokens
                    return {
                        ...level,
                        amountUSDC: quotePerBuyLevel.toNumber(), // Fixed USDC to spend
                        amountBase: quotePerBuyLevel
                            .div(Decimal.from(level.price.toNumber()))
                            .toNumber(), // Tokens to receive = USDC / price
                    };
                case OrderSide.Sell:
                    // SELL order: sell fixed tokens, receive variable USDC
                    return {
                        ...level,
                        amountBase: basePerSellLevel.toNumber(), // Fixed tokens to sell
                        amountUSDC: basePerSellLevel
                            .mul(Decimal.from(level.price.toNumber()))
                            .toNumber(), // USDC to receive = tokens * price
                    };
            }
        });
    }
}
