import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus } from '@domain/models/order/order-status';
import { GRIDS_API_PORT, GridsApiPort } from '@components/grids/api/grids-api.port';
import { OrderDto } from '@/components/grids/api/dto/order.dto';
import { ExchangeOpenOrder } from '@components/trading/core/domain/models/exchange-order/exchange-open-order';
import { logger } from '@/infra/logger/logger';
import { Config } from '@/config/config.schema';

/**
 * Service to restore orders that were placed on exchange but not updated in DB.
 */
@Injectable()
export class OrderRestoreService {
    private readonly logger = logger.child({ context: OrderRestoreService.name });
    private readonly staleThresholdMs: number;

    constructor(
        @Inject(GRIDS_API_PORT) private readonly grids: GridsApiPort,
        private readonly configService: ConfigService<Config, true>,
    ) {
        const config = this.configService.get('orders', { infer: true });
        this.staleThresholdMs = config.pendingCleanupThresholdMs;
    }

    async restoreOrders(exchangeOpenOrders: ExchangeOpenOrder[]): Promise<number> {
        const dbPendingOrders = await this.grids.findOrdersByStatus(OrderStatus.Pending);

        if (dbPendingOrders.length === 0) {
            this.logger.debug('No pending orders to restore');
            return 0;
        }

        this.logger.debug(
            { pendingOrders: dbPendingOrders.length },
            'Checking pending orders for restoration',
        );

        return await this.restorePendingOrders(dbPendingOrders, exchangeOpenOrders);
    }

    private async restorePendingOrders(
        dbPendingOrders: OrderDto[],
        exchangeOpenOrders: ExchangeOpenOrder[],
    ): Promise<number> {
        let restoredCount = 0;

        for (const dbOrder of dbPendingOrders) {
            const restored = await this.tryRestoreOrder(dbOrder, exchangeOpenOrders);
            if (restored) {
                restoredCount++;
            } else {
                await this.cleanupStaleOrder(dbOrder);
            }
        }

        if (restoredCount > 0) {
            this.logger.info({ restoredCount }, 'Orders restoration completed');
        }

        return restoredCount;
    }

    private async tryRestoreOrder(
        dbOrder: OrderDto,
        exchangeOrders: ExchangeOpenOrder[],
    ): Promise<boolean> {
        const orderId = dbOrder.id;
        const matchingOrders = exchangeOrders.filter((o) => o.cloid?.toOrderId() === orderId);

        if (matchingOrders.length === 0) {
            return false;
        }

        if (matchingOrders.length > 1) {
            this.logger.warn(
                { orderId, matchCount: matchingOrders.length },
                'Multiple exchange orders found with same cloid - skipping restoration',
            );
            return false;
        }

        const exchangeOrder = matchingOrders[0];

        await this.grids.updateOrderExchangeId(
            orderId,
            exchangeOrder.id,
            OrderStatus.Placed,
            new Date(),
        );

        this.logger.info({ orderId, exchangeOrderId: exchangeOrder.id }, 'Order restored by cloid');

        return true;
    }

    private async cleanupStaleOrder(order: OrderDto): Promise<void> {
        if (!order.placedAt) {
            return;
        }

        const orderAge = Date.now() - order.placedAt;
        if (orderAge < this.staleThresholdMs) {
            return;
        }

        await this.grids.updateOrderStatus(order.id, OrderStatus.Missing);

        this.logger.warn(
            {
                orderId: order.id,
                gridId: order.gridId,
                levelIndex: order.levelIndex,
                ageMs: orderAge,
            },
            'Stale pending order marked as missing',
        );
    }
}
