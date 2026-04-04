import { OrderDto } from '@components/grids/api/dto/order.dto';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { Price } from '@domain/models/primitives/price';
import { Decimal } from '@domain/models/primitives/decimal';
import { OrderSide } from '@domain/models/order/order-side';

/**
 * Refill Parameters
 *
 * Encapsulates parameters for a refill order that should be placed
 * after an order in the grid is filled.
 *
 * Grid trading logic:
 * - When a BUY order is filled → place a SELL order one level higher
 * - When a SELL order is filled → place a BUY order one level lower
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
     * @returns RefillParams for the new order, or null if at edge level
     */
    static calc(filledOrder: OrderDto, grid: GridDto): RefillParams | null {
        const currentLevel = filledOrder.levelIndex;
        const priceStep = (grid.upperPrice - grid.lowerPrice) / grid.levels;
        const getLevelPrice = (i: number): Price => Price.from(grid.lowerPrice + priceStep * i);

        if (filledOrder.side === OrderSide.Buy) {
            const refillLevel = currentLevel + 1;
            if (refillLevel > grid.levels) return null;
            return new RefillParams(
                OrderSide.Sell,
                refillLevel,
                getLevelPrice(refillLevel),
                Decimal.from(filledOrder.amount),
            );
        } else {
            const refillLevel = currentLevel - 1;
            if (refillLevel < 0) return null;
            return new RefillParams(
                OrderSide.Buy,
                refillLevel,
                getLevelPrice(refillLevel),
                Decimal.from(filledOrder.amount),
            );
        }
    }
}
