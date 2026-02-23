import { Order } from '@domain/models/order/order';
import { OrderSide } from '@domain/models/order/order-side';
import { Grid } from '@domain/models/grid/grid';
import { Price } from '@domain/models/primitives/price';
import { Decimal } from '@domain/models/primitives/decimal';

/**
 * Refill Parameters
 *
 * Encapsulates parameters for a refill order that should be placed
 * after an order in the grid is filled.
 *
 * Grid trading logic:
 * - When a BUY order is filled → place a SELL order one level higher
 * - When a SELL order is filled → place a BUY order one level lower
 *
 * This creates a cycle: "buy low → sell high" or "sell high → buy low",
 * capturing profit from price oscillations within the grid range.
 */
export class RefillParams {
    constructor(
        readonly side: OrderSide,
        readonly levelIndex: number,
        readonly price: Price,
        readonly amount: Decimal,
    ) {}

    /**
     * Calculate refill parameters for a filled order.
     *
     * Logic:
     * - BUY filled at level N → SELL at level N+1 (higher price)
     * - SELL filled at level N → BUY at level N-1 (lower price)
     *
     * @param filledOrder - The order that was just filled
     * @param grid - The grid configuration containing price levels
     * @returns RefillParams for the new order, or null if at edge level (no refill possible)
     *
     * @example
     * // Grid with 5 levels (0-4), prices $100-$200
     * // BUY at level 1 ($125) filled → returns SELL at level 2 ($150)
     * // SELL at level 3 ($175) filled → returns BUY at level 2 ($150)
     * // BUY at level 4 ($200) filled → returns null (edge level)
     * // SELL at level 0 ($100) filled → returns null (edge level)
     */
    static calc(filledOrder: Order, grid: Grid): RefillParams | null {
        const currentLevel = filledOrder.levelIndex;

        if (filledOrder.side === OrderSide.Buy) {
            const refillLevel = currentLevel + 1;

            if (refillLevel >= grid.levels) {
                return null;
            }

            return new RefillParams(
                OrderSide.Sell,
                refillLevel,
                grid.getLevelPrice(refillLevel),
                filledOrder.amount,
            );
        } else {
            const refillLevel = currentLevel - 1;

            if (refillLevel < 0) {
                return null;
            }

            return new RefillParams(
                OrderSide.Buy,
                refillLevel,
                grid.getLevelPrice(refillLevel),
                filledOrder.amount,
            );
        }
    }
}
