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

@Injectable()
export class StopLossOrderCancellationService {
    private readonly logger = logger.child({ context: StopLossOrderCancellationService.name });

    constructor(
        @Inject(GRIDS_API_PORT) private readonly grids: GridsApiPort,
        @Inject(EXCHANGE_PORT) private readonly exchange: ExchangePort,
    ) {}

    async cancelActiveOrders(gridId: string, accountAddress: string): Promise<void> {
        const activeOrders = await this.grids.findActiveOrdersByGridId(gridId);

        for (const order of activeOrders) {
            await this.cancelOrder(order, accountAddress);
        }

        this.logger.info({ gridId, cancelledOrders: activeOrders.length }, 'Orders cancelled');
    }

    private async cancelOrder(order: OrderDto, accountAddress: string): Promise<void> {
        if (!order.exchangeOrderId) {
            await this.grids.updateOrderStatus(order.id, OrderStatus.Cancelled);
            return;
        }

        try {
            await this.exchange.cancelSpotOrder({
                symbol: TradingSymbol.create(order.symbol),
                exchangeOrderId: order.exchangeOrderId,
                accountAddress,
            });
            await this.grids.updateOrderStatus(order.id, OrderStatus.Cancelled);
        } catch (error) {
            // Exchange cancel failed — leave DB status unchanged to avoid phantom "Cancelled" state.
            this.logger.warn(
                { error, orderId: order.id },
                'Failed to cancel order on exchange during stop-loss teardown — DB status unchanged',
            );
        }
    }
}
