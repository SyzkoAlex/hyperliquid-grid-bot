import { Inject, Injectable } from '@nestjs/common';
import { logger } from '@/infra/logger/logger';
import { GridStatus } from '@domain/models/grid/grid-status';
import { OrderStatus } from '@domain/models/order/order-status';
import { GRIDS_API_PORT, GridsApiPort } from '@components/grids/api/grids-api.port';
import { OrderDto } from '@components/grids/api/dto/order.dto';
import { OrderCancellationService } from '../order-cancellation/order-cancellation.service';

const TERMINAL_GRID_STATUSES = new Set([GridStatus.Stopped, GridStatus.Error]);

/**
 * Cancels the orders a grid left resting on the exchange after it stopped being managed.
 *
 * StopGridUseCase marks the grid Stopped before it cancels the orders, so a stop interrupted in
 * between (a DB error, a restart mid cancel-loop) leaves live orders behind — and nothing revisits
 * them: the Stop button is rendered for Running grids only, and every active-grid query filters on
 * Running, so the order sync never sees them either. This sweep runs with the periodic order
 * restore and is their only recovery path.
 *
 * Only terminal grids are swept. An Idle grid is mid-creation (orders are placed after the grid
 * goes Running) and a Paused grid is meant to keep its orders resting, so neither is touched.
 *
 * Only Placed orders are swept. A Pending row never carries an exchangeOrderId, so cancelling it
 * would merely flip the DB row to a terminal status while a placement the exchange did accept
 * keeps resting — and a terminal row can no longer be matched by cloid. Such rows belong to
 * OrderRestoreService, which either attaches their exchangeOrderId or retires them to Missing.
 */
@Injectable()
export class LeftoverOrderSweepService {
    private readonly logger = logger.child({ context: LeftoverOrderSweepService.name });

    constructor(
        @Inject(GRIDS_API_PORT) private readonly grids: GridsApiPort,
        private readonly orderCancellation: OrderCancellationService,
    ) {}

    /** @returns the number of orders cancelled for the given user */
    async sweep(accountAddress: string, userId: string): Promise<number> {
        const ordersByGridId = await this.groupPlacedOrdersByGridId();

        let cancelled = 0;
        for (const [gridId, orders] of ordersByGridId) {
            const grid = await this.grids.findGridByIdForSystem(gridId);
            if (!grid || grid.userId !== userId || !TERMINAL_GRID_STATUSES.has(grid.status)) {
                continue;
            }

            this.logger.warn(
                { gridId, symbol: grid.symbol, status: grid.status, orderCount: orders.length },
                'Cancelling orders left active by a grid that is no longer running',
            );

            for (const order of orders) {
                if (await this.cancelOrderSafe(order, accountAddress)) cancelled++;
            }
        }

        return cancelled;
    }

    private async groupPlacedOrdersByGridId(): Promise<Map<string, OrderDto[]>> {
        const ordersByGridId = new Map<string, OrderDto[]>();

        for (const order of await this.grids.findOrdersByStatus(OrderStatus.Placed)) {
            ordersByGridId.set(order.gridId, [...(ordersByGridId.get(order.gridId) ?? []), order]);
        }

        return ordersByGridId;
    }

    private async cancelOrderSafe(order: OrderDto, accountAddress: string): Promise<boolean> {
        try {
            await this.orderCancellation.cancelOrder(order, accountAddress);
            return true;
        } catch (err) {
            this.logger.error(
                { err, orderId: order.id, gridId: order.gridId },
                'Failed to cancel a leftover order',
            );
            return false;
        }
    }
}
