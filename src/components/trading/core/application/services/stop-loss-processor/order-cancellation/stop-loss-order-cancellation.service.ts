import { Inject, Injectable } from '@nestjs/common';
import { logger } from '@/infra/logger/logger';
import { OrderStatus } from '@domain/models/order/order-status';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { GRIDS_API_PORT, GridsApiPort } from '@components/grids/api/grids-api.port';
import {
    EXCHANGE_PORT,
    ExchangePort,
} from '@components/trading/core/application/ports/exchange.port';
import { OrderDto } from '@components/grids/api/dto/order.dto';
import { CancelActiveOrdersResult } from './types/cancel-active-orders-result';

@Injectable()
export class StopLossOrderCancellationService {
    private readonly logger = logger.child({ context: StopLossOrderCancellationService.name });

    constructor(
        @Inject(GRIDS_API_PORT) private readonly grids: GridsApiPort,
        @Inject(EXCHANGE_PORT) private readonly exchange: ExchangePort,
    ) {}

    async cancelActiveOrders(
        gridId: string,
        accountAddress: string,
    ): Promise<CancelActiveOrdersResult> {
        const activeOrders = await this.grids.findActiveOrdersByGridId(gridId);

        const results = await Promise.allSettled(
            activeOrders.map((order) => this.cancelOrder(order, accountAddress)),
        );

        let cancelledCount = 0;
        let failedCount = 0;

        for (const r of results) {
            if (r.status === 'fulfilled' && r.value) {
                cancelledCount++;
            } else {
                failedCount++;
            }
        }

        this.logger.info({ gridId, cancelledCount, failedCount }, 'Orders cancelled');

        return { cancelledCount, failedCount };
    }

    private async cancelOrder(order: OrderDto, accountAddress: string): Promise<boolean> {
        if (!order.exchangeOrderId) {
            await this.grids.updateOrderStatus(order.id, OrderStatus.Cancelled);
            return true;
        }

        try {
            await this.exchange.cancelSpotOrder({
                symbol: TradingSymbol.create(order.symbol),
                exchangeOrderId: order.exchangeOrderId,
                accountAddress,
            });
            await this.grids.updateOrderStatus(order.id, OrderStatus.Cancelled);
            return true;
        } catch (error) {
            // Exchange cancel failed — leave DB status unchanged to avoid phantom "Cancelled" state.
            this.logger.warn(
                { error, orderId: order.id },
                'Failed to cancel order on exchange during stop-loss teardown — DB status unchanged',
            );
            return false;
        }
    }
}
