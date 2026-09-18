import { Inject, Injectable } from '@nestjs/common';
import { logger } from '@/infra/logger/logger';
import { GRIDS_API_PORT, GridsApiPort } from '@components/grids/api/grids-api.port';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { OrderDto } from '@components/grids/api/dto/order.dto';
import { GridStatus } from '@domain/models/grid/grid-status';
import { Price } from '@domain/models/primitives/price';
import { Decimal } from '@domain/models/primitives/decimal';
import { RefillParams } from '@components/trading/core/application/services/order-refill/refill-params';
import { RefillOrderPlacementService } from '@components/trading/core/application/services/refill-order-placement/refill-order-placement.service';

/**
 * Recovers orders cancelled by Hyperliquid's Self-Trade Prevention (STP) mechanism.
 * Called during each sync cycle when the order-status sync detects stpCancelledOrders.
 * Recovery re-places the cancelled order at the same order index and side, provided it does not
 * cross any active opposite-side order of the grid. Re-placing a crossing order would be
 * STP-cancelled again (or cancel the other order), looping every sync cycle; the skipped pair is
 * picked up later by EmptyLevelRepairService once the crossing is gone.
 */
@Injectable()
export class StpRecoveryService {
    private readonly logger = logger.child({ context: StpRecoveryService.name });

    constructor(
        @Inject(GRIDS_API_PORT) private readonly grids: GridsApiPort,
        private readonly refillPlacement: RefillOrderPlacementService,
    ) {}

    async recoverMany(
        stpOrders: OrderDto[],
        grid: GridDto,
        accountAddress: string,
    ): Promise<number> {
        if (grid.status !== GridStatus.Running) return 0;
        if (stpOrders.length === 0) return 0;

        const activeOrders = await this.grids.findActiveOrdersByGridId(grid.id);

        let placed = 0;
        for (const order of stpOrders) {
            if (await this.recoverOne(order, grid, accountAddress, activeOrders)) placed++;
        }
        return placed;
    }

    private async recoverOne(
        stpOrder: OrderDto,
        grid: GridDto,
        accountAddress: string,
        activeOrders: OrderDto[],
    ): Promise<boolean> {
        try {
            if (stpOrder.price == null) {
                this.logger.warn(
                    { orderId: stpOrder.id, orderIndex: stpOrder.orderIndex, gridId: grid.id },
                    'STP recovery skipped: order has no price',
                );
                return false;
            }

            const params = new RefillParams(
                stpOrder.side,
                stpOrder.orderIndex,
                Price.from(stpOrder.price),
                Decimal.from(stpOrder.amount),
            );

            const crossingOrder = params.findCrossingOrder(activeOrders);
            if (crossingOrder) {
                this.logger.warn(
                    {
                        orderIndex: stpOrder.orderIndex,
                        side: stpOrder.side,
                        gridId: grid.id,
                        crossingOrderId: crossingOrder.id,
                        crossingOrderIndex: crossingOrder.orderIndex,
                    },
                    'STP recovery skipped: order would cross an active opposite-side order',
                );
                return false;
            }

            const result = await this.refillPlacement.placeRefillOrder(
                grid,
                params,
                accountAddress,
            );

            if (result.success) {
                if (result.order && !result.immediatelyFilled) activeOrders.push(result.order);
                this.logger.info(
                    { orderIndex: stpOrder.orderIndex, side: stpOrder.side, gridId: grid.id },
                    'Order re-placed after STP cancellation',
                );
                return true;
            }

            this.logger.warn(
                {
                    orderIndex: stpOrder.orderIndex,
                    side: stpOrder.side,
                    gridId: grid.id,
                    error: result.error,
                },
                'STP recovery failed to re-place order',
            );
            return false;
        } catch (error) {
            this.logger.warn(
                { error, orderIndex: stpOrder.orderIndex, gridId: grid.id },
                'STP recovery error for order',
            );
            return false;
        }
    }
}
