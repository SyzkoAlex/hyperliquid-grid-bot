import { Grid } from '@domain/models/grid/grid';
import { Order } from '@domain/models/order/order';
import { ExchangeOpenOrder } from '@components/trading/domain/models/exchange-order/exchange-open-order';

export class GridWithOrders {
    constructor(
        public readonly grid: Grid,
        public readonly dbOrders: Order[],
        public readonly exchangeOrders: ExchangeOpenOrder[],
    ) {}

    static buildMany(
        grids: Grid[],
        dbOrders: Order[],
        exchangeOpenOrders: ExchangeOpenOrder[],
    ): GridWithOrders[] {
        const exchangeByGridId = GridWithOrders.groupExchangeOrdersByGridId(
            exchangeOpenOrders,
            dbOrders,
        );

        return grids
            .map((grid) => {
                const gridId = grid.id.toString();
                return new GridWithOrders(
                    grid,
                    dbOrders.filter((o) => o.gridId.equals(grid.id)),
                    exchangeByGridId.get(gridId) ?? [],
                );
            })
            .filter((g) => g.hasDbOrders());
    }

    hasDbOrders(): boolean {
        return this.dbOrders.length > 0;
    }

    private static groupExchangeOrdersByGridId(
        exchangeOrders: ExchangeOpenOrder[],
        dbOrders: Order[],
    ): Map<string, ExchangeOpenOrder[]> {
        const orderIdToGridId = new Map(
            dbOrders.map((o) => [o.id.toString(), o.gridId.toString()]),
        );
        const result = new Map<string, ExchangeOpenOrder[]>();

        for (const exchangeOrder of exchangeOrders) {
            const orderId = exchangeOrder.cloid?.toOrderId();
            if (!orderId) continue;

            const gridId = orderIdToGridId.get(orderId.toString());
            if (!gridId) continue;

            const existing = result.get(gridId) ?? [];
            existing.push(exchangeOrder);
            result.set(gridId, existing);
        }

        return result;
    }
}
