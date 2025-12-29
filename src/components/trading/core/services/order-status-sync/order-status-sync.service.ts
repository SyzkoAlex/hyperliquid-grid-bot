import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExchangeOpenOrder } from '../../domain/exchange-order/exchange-open-order';
import { OrderStatus } from '../../domain/order/order-status';
import { Order } from '../../domain/order/order';
import { logger } from '../../../../../infra/logger/logger';
import { HyperliquidOrderClient } from '../../../secondary/client/hyperliquid/hyperliquid-order.client';
import { Config } from '../../../../../infra/config/config.schema';
import { PostgresOrderRepository } from '../../../secondary/repository/order/postgres-order.repository';
import { ExchangeOrderInfo } from '../../domain/exchange-order/exchange-order-info';
import { OrderStatusSyncResult } from './order-status-sync-result';
import { ExchangeStatusMapper } from '../../domain/exchange-order/exchange-status.mapper';

@Injectable()
export class OrderStatusSyncService {
    private readonly logger = logger.child({ context: OrderStatusSyncService.name });
    private readonly accountAddress: string;

    constructor(
        private readonly orderClient: HyperliquidOrderClient,
        private readonly configService: ConfigService<Config, true>,
        private readonly orderRepository: PostgresOrderRepository,
    ) {
        this.accountAddress = this.configService.get('hyperliquid', { infer: true }).accountAddress;
    }

    /**
     * Detect closed orders and update their statuses in DB.
     * Returns a result with statistics about processed orders.
     */
    async process(
        activeDbOrders: Order[],
        exchangeOpenOrders: ExchangeOpenOrder[],
    ): Promise<OrderStatusSyncResult> {
        const result = OrderStatusSyncResult.empty();

        const closedOrders = this.findClosedOrders(activeDbOrders, exchangeOpenOrders);

        if (closedOrders.length === 0) {
            return result;
        }

        this.logger.debug(
            { count: closedOrders.length },
            'Detected closed orders, fetching statuses',
        );

        const statusInfoMap = await this.fetchExchangeOrderStatuses(closedOrders);

        for (const order of closedOrders) {
            const exchangeOrderInfo = statusInfoMap.get(order.exchangeOrderId!);
            const newStatus = this.resolveOrderStatus(order, exchangeOrderInfo);

            await this.updateOrderStatus(order, newStatus, exchangeOrderInfo?.statusTimestamp);

            this.updateProcessResult(result, newStatus, order);
        }

        return result;
    }

    /**
     * Find orders that exist in DB but not in exchange open orders.
     */
    private findClosedOrders(dbOrders: Order[], exchangeOrders: ExchangeOpenOrder[]): Order[] {
        const openOrderIds = new Set(exchangeOrders.map((o) => o.id));

        return dbOrders.filter((o) => o.exchangeOrderId && !openOrderIds.has(o.exchangeOrderId));
    }

    /**
     * Fetch order statuses for closed orders by querying each individually from the exchange.
     */
    private async fetchExchangeOrderStatuses(
        closedOrders: Order[],
    ): Promise<Map<string, ExchangeOrderInfo>> {
        const statusMap = new Map<string, ExchangeOrderInfo>();

        // Query each order status individually
        const statusPromises = closedOrders.map(async (order) => {
            if (!order.exchangeOrderId) {
                return;
            }

            try {
                const exchangeOrderStatus = await this.orderClient.getOrderStatus(
                    this.accountAddress,
                    order.exchangeOrderId,
                );

                if (exchangeOrderStatus) {
                    statusMap.set(order.exchangeOrderId, exchangeOrderStatus);
                }
            } catch (error) {
                this.logger.error(
                    { error, orderId: order.id.toString(), exchangeOrderId: order.exchangeOrderId },
                    'Failed to fetch order status',
                );
            }
        });

        await Promise.allSettled(statusPromises);

        this.logger.debug(
            { requested: closedOrders.length, found: statusMap.size },
            'Fetched order statuses from exchange',
        );

        return statusMap;
    }

    /**
     * Resolve final order status based on exchange status info.
     * If status info is missing, mark it as Missing.
     */
    private resolveOrderStatus(order: Order, exchangeOrderInfo?: ExchangeOrderInfo): OrderStatus {
        if (!exchangeOrderInfo) {
            this.logger.warn(
                { exchangeOrderId: order.exchangeOrderId },
                'Order status not found on exchange - marking as missing',
            );
            return OrderStatus.Missing;
        }

        return ExchangeStatusMapper.mapToOrderStatus(exchangeOrderInfo.status);
    }

    /**
     * Update order status in database.
     */
    private async updateOrderStatus(
        order: Order,
        newStatus: OrderStatus,
        statusTimestamp?: number,
    ): Promise<void> {
        const filledTimestamp = statusTimestamp ? new Date(statusTimestamp) : new Date();

        await this.orderRepository.updateStatus(
            order.id.toString(),
            newStatus,
            newStatus === OrderStatus.Filled ? filledTimestamp : undefined,
        );
    }

    /**
     * Update process result counters based on order status.
     */
    private updateProcessResult(
        result: OrderStatusSyncResult,
        status: OrderStatus,
        order: Order,
    ): void {
        result.incrementProcessed();

        switch (status) {
            case OrderStatus.Filled:
                result.incrementFilled();
                result.addFilledOrder(order);
                break;
            case OrderStatus.Cancelled:
                result.incrementCancelled();
                break;
            case OrderStatus.Missing:
                result.incrementMissing();
                break;
            case OrderStatus.Failed:
                result.incrementFailed();
                break;
        }
    }
}
