import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus } from '@domain/models/order/order-status';
import { ExchangeOpenOrder } from '@components/trading/core/domain/models/exchange-order/exchange-open-order';
import { OrderDto } from '@components/grids/api/dto/order.dto';
import { logger } from '@/infra/logger/logger';
import {
    EXCHANGE_PORT,
    ExchangePort,
} from '@components/trading/core/application/ports/exchange.port';
import { Config } from '@/config/config.schema';
import { GRIDS_API_PORT, GridsApiPort } from '@components/grids/api/grids-api.port';
import { ExchangeOrderInfo } from '@components/trading/core/domain/models/exchange-order/exchange-order-info';
import { OrderStatusSyncResult } from './order-status-sync-result';
import { ExchangeStatusMapper } from '@components/trading/core/domain/models/exchange-order/exchange-status.mapper';

@Injectable()
export class OrderStatusSyncService {
    private readonly logger = logger.child({ context: OrderStatusSyncService.name });
    private readonly accountAddress: string;

    constructor(
        @Inject(EXCHANGE_PORT) private readonly exchange: ExchangePort,
        private readonly configService: ConfigService<Config, true>,
        @Inject(GRIDS_API_PORT) private readonly grids: GridsApiPort,
    ) {
        this.accountAddress = this.configService.get('hyperliquid', { infer: true }).accountAddress;
    }

    /**
     * Detect closed orders and update their statuses in DB.
     */
    async process(
        activeDbOrders: OrderDto[],
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

    private findClosedOrders(
        dbOrders: OrderDto[],
        exchangeOrders: ExchangeOpenOrder[],
    ): OrderDto[] {
        const openOrderIds = new Set(exchangeOrders.map((o) => o.id));
        return dbOrders.filter((o) => o.exchangeOrderId && !openOrderIds.has(o.exchangeOrderId));
    }

    private async fetchExchangeOrderStatuses(
        closedOrders: OrderDto[],
    ): Promise<Map<string, ExchangeOrderInfo>> {
        const statusMap = new Map<string, ExchangeOrderInfo>();

        const statusPromises = closedOrders.map(async (order) => {
            if (!order.exchangeOrderId) return;

            try {
                const exchangeOrderStatus = await this.exchange.getOrderStatus(
                    this.accountAddress,
                    order.exchangeOrderId,
                );

                if (exchangeOrderStatus) {
                    statusMap.set(order.exchangeOrderId, exchangeOrderStatus);
                }
            } catch (error) {
                this.logger.error(
                    { error, orderId: order.id, exchangeOrderId: order.exchangeOrderId },
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

    private resolveOrderStatus(
        order: OrderDto,
        exchangeOrderInfo?: ExchangeOrderInfo,
    ): OrderStatus {
        if (!exchangeOrderInfo) {
            this.logger.warn(
                { exchangeOrderId: order.exchangeOrderId },
                'Order status not found on exchange - marking as missing',
            );
            return OrderStatus.Missing;
        }

        return ExchangeStatusMapper.mapToOrderStatus(exchangeOrderInfo.status);
    }

    private async updateOrderStatus(
        order: OrderDto,
        newStatus: OrderStatus,
        statusTimestamp?: number,
    ): Promise<void> {
        const filledTimestamp = statusTimestamp ? new Date(statusTimestamp) : new Date();

        await this.grids.updateOrderStatus(
            order.id,
            newStatus,
            newStatus === OrderStatus.Filled ? filledTimestamp : undefined,
        );
    }

    private updateProcessResult(
        result: OrderStatusSyncResult,
        status: OrderStatus,
        order: OrderDto,
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
