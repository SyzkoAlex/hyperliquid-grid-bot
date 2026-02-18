import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    ORDER_REPOSITORY_PORT,
    OrderRepositoryPort,
} from '@components/trading/domain/ports/outbound/order-repository.port';
import { ExchangeOpenOrder } from '@components/trading/domain/models/exchange-order/exchange-open-order';
import { OrderStatus } from '@domain/models/order/order-status';
import { Order } from '@domain/models/order/order';
import { logger } from '../../../../../infra/logger/logger';
import { Config } from '../../../../../infra/config/config.schema';

/**
 * Service to restore orders that were placed on exchange but not updated in DB.
 *
 * This can happen during bot restart when:
 * 1. Order was sent to exchange successfully
 * 2. Bot crashed/restarted before updating DB with exchangeOrderId
 * 3. Order remains in DB with status=Pending and no exchangeOrderId
 *
 * We restore such orders by:
 * - Finding them by exchangeOrderId in allOpenOrders from exchange
 * - Updating DB with status=Placed
 * - Marking stale pending orders (not found on exchange) as Missing
 */
@Injectable()
export class OrderRestoreService {
    private readonly logger = logger.child({ context: OrderRestoreService.name });
    private readonly staleThresholdMs: number;

    constructor(
        @Inject(ORDER_REPOSITORY_PORT) private readonly orderRepository: OrderRepositoryPort,
        private readonly configService: ConfigService<Config, true>,
    ) {
        const config = this.configService.get('orders', { infer: true });
        this.staleThresholdMs = config.pendingCleanupThresholdMs;
    }

    async restoreOrders(exchangeOpenOrders: ExchangeOpenOrder[]): Promise<number> {
        const dbPendingOrders = await this.orderRepository.findManyByStatus(OrderStatus.Pending);

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
        dbPendingOrders: Order[],
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
        dbOrder: Order,
        exchangeOrders: ExchangeOpenOrder[],
    ): Promise<boolean> {
        if (dbOrder.cloid) {
            return await this.restoreByCloid(dbOrder, exchangeOrders);
        }

        return false;
    }

    private async restoreByCloid(
        dbOrder: Order,
        exchangeOrders: ExchangeOpenOrder[],
    ): Promise<boolean> {
        const cloidStr = dbOrder.cloid!.toString();
        const matchingOrders = exchangeOrders.filter((o) => o.cloid?.toString() === cloidStr);

        if (matchingOrders.length === 0) {
            return false;
        }

        if (matchingOrders.length > 1) {
            this.logger.warn(
                {
                    orderId: dbOrder.id.toString(),
                    cloid: cloidStr,
                    matchCount: matchingOrders.length,
                },
                'Multiple exchange orders found with same cloid - skipping restoration',
            );
            return false;
        }

        const exchangeOrder = matchingOrders[0];

        await this.orderRepository.updateExchangeOrderId(
            dbOrder.id.toString(),
            exchangeOrder.id,
            OrderStatus.Placed,
            new Date(),
        );

        this.logger.info(
            {
                orderId: dbOrder.id.toString(),
                exchangeOrderId: exchangeOrder.id,
                cloid: cloidStr,
            },
            'Order restored by cloid',
        );

        return true;
    }

    private async cleanupStaleOrder(order: Order): Promise<void> {
        if (!order.placedAt) {
            return;
        }

        const orderAge = Date.now() - order.placedAt.toUnixMilliseconds();
        if (orderAge < this.staleThresholdMs) {
            return;
        }

        await this.orderRepository.updateStatus(order.id.toString(), OrderStatus.Missing);

        this.logger.warn(
            {
                orderId: order.id.toString(),
                gridId: order.gridId,
                levelIndex: order.levelIndex,
                ageMs: orderAge,
            },
            'Stale pending order marked as missing',
        );
    }
}
