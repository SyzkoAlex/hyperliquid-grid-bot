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
 * - When a BUY order is filled → place a SELL order one order higher
 * - When a SELL order is filled → place a BUY order one order lower
 */
export class RefillParams {
    constructor(
        readonly side: OrderSide,
        readonly orderIndex: number,
        readonly price: Price,
        readonly amount: Decimal,
    ) {}

    /**
     * Calculate refill parameters for a filled order.
     *
     * Logic:
     * - BUY filled at index N → SELL at index N+1 (higher price)
     * - SELL filled at index N → BUY at index N-1 (lower price)
     *
     * @returns RefillParams for the new order, or null if at edge index
     */
    static calc(filledOrder: OrderDto, grid: GridDto): RefillParams | null {
        const currentIndex = filledOrder.orderIndex;
        const priceStep = (grid.upperPrice - grid.lowerPrice) / (grid.orderCount - 1);
        const getOrderPrice = (i: number): Price => Price.from(grid.lowerPrice + priceStep * i);

        if (filledOrder.side === OrderSide.Buy) {
            const refillIndex = currentIndex + 1;
            if (refillIndex > grid.orderCount - 1) return null;
            return new RefillParams(
                OrderSide.Sell,
                refillIndex,
                getOrderPrice(refillIndex),
                Decimal.from(filledOrder.amount),
            );
        } else {
            const refillIndex = currentIndex - 1;
            if (refillIndex < 0) return null;
            return new RefillParams(
                OrderSide.Buy,
                refillIndex,
                getOrderPrice(refillIndex),
                Decimal.from(filledOrder.amount),
            );
        }
    }

    /**
     * Find an active opposite-side order this order would cross (a buy priced at or above
     * a resting sell, or a sell at or below a resting buy). Placing it triggers Hyperliquid's
     * self-trade prevention, which cancels one of the two.
     */
    findCrossingOrder(activeOrders: OrderDto[]): OrderDto | undefined {
        const price = this.price.toNumber();
        return activeOrders.find((o) => {
            if (o.side === this.side || o.price === null) return false;
            return this.side === OrderSide.Buy ? o.price <= price : o.price >= price;
        });
    }
}
