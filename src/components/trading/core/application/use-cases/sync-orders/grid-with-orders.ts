import { GridDto } from '@/components/grids/api/dto/grid.dto';
import { OrderDto } from '@/components/grids/api/dto/order.dto';
import { ExchangeOpenOrder } from '@components/trading/core/domain/models/exchange-order/exchange-open-order';

export class GridWithOrders {
    constructor(
        public readonly grid: GridDto,
        public readonly dbOrders: OrderDto[],
        public readonly exchangeOrders: ExchangeOpenOrder[],
    ) {}

    static buildMany(
        grids: GridDto[],
        dbOrders: OrderDto[],
        exchangeOpenOrders: ExchangeOpenOrder[],
    ): GridWithOrders[] {
        const exchangeByGridId = GridWithOrders.groupExchangeOrdersByGridId(
            exchangeOpenOrders,
            dbOrders,
        );

        return grids
            .map((grid) => {
                return new GridWithOrders(
                    grid,
                    dbOrders.filter((o) => o.gridId === grid.id),
                    exchangeByGridId.get(grid.id) ?? [],
                );
            })
            .filter((g) => g.hasDbOrders());
    }

    hasDbOrders(): boolean {
        return this.dbOrders.length > 0;
    }

    private static groupExchangeOrdersByGridId(
        exchangeOrders: ExchangeOpenOrder[],
        dbOrders: OrderDto[],
    ): Map<string, ExchangeOpenOrder[]> {
        const orderIdToGridId = new Map(dbOrders.map((o) => [o.id, o.gridId]));
        const result = new Map<string, ExchangeOpenOrder[]>();

        for (const exchangeOrder of exchangeOrders) {
            const orderId = exchangeOrder.cloid?.toOrderId();
            if (!orderId) continue;

            const gridId = orderIdToGridId.get(orderId);
            if (!gridId) continue;

            const existing = result.get(gridId) ?? [];
            existing.push(exchangeOrder);
            result.set(gridId, existing);
        }

        return result;
    }
}
