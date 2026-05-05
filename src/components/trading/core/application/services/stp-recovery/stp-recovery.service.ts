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
 * Recovery re-places the cancelled order at the same level and side, provided no
 * conflicting order on the opposite side exists at that level.
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
                    { orderId: stpOrder.id, levelIndex: stpOrder.levelIndex, gridId: grid.id },
                    'STP recovery skipped: order has no price',
                );
                return false;
            }

            const hasConflict = activeOrders.some(
                (o) => o.levelIndex === stpOrder.levelIndex && o.side !== stpOrder.side,
            );

            if (hasConflict) {
                this.logger.warn(
                    { levelIndex: stpOrder.levelIndex, side: stpOrder.side, gridId: grid.id },
                    'STP recovery skipped: conflicting order on opposite side at same level',
                );
                return false;
            }

            const params = new RefillParams(
                stpOrder.side,
                stpOrder.levelIndex,
                Price.from(stpOrder.price),
                Decimal.from(stpOrder.amount),
            );

            const result = await this.refillPlacement.placeRefillOrder(
                grid,
                params,
                accountAddress,
            );

            if (result.success) {
                this.logger.info(
                    { levelIndex: stpOrder.levelIndex, side: stpOrder.side, gridId: grid.id },
                    'Order re-placed after STP cancellation',
                );
                return true;
            }

            this.logger.warn(
                {
                    levelIndex: stpOrder.levelIndex,
                    side: stpOrder.side,
                    gridId: grid.id,
                    error: result.error,
                },
                'STP recovery failed to re-place order',
            );
            return false;
        } catch (error) {
            this.logger.warn(
                { error, levelIndex: stpOrder.levelIndex, gridId: grid.id },
                'STP recovery error for order',
            );
            return false;
        }
    }
}
