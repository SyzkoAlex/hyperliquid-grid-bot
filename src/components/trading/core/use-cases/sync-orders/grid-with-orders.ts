import { Grid } from '../../domain/grid/grid';
import { Order } from '../../domain/order/order';
import { ExchangeOpenOrder } from '../../domain/exchange-order/exchange-open-order';

/**
 * Aggregates grid with its related orders from both DB and exchange
 * Used in sync-orders use case for easier data passing
 */
export class GridWithOrders {
    constructor(
        public readonly grid: Grid,
        public readonly dbOrders: Order[],
        public readonly exchangeOrders: ExchangeOpenOrder[],
    ) {}

    hasDbOrders(): boolean {
        return this.dbOrders.length > 0;
    }
}
