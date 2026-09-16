import { Inject, Injectable } from '@nestjs/common';
import { logger } from '@/infra/logger/logger';
import { OrderStatus } from '@domain/models/order/order-status';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { GRIDS_API_PORT, GridsApiPort } from '@components/grids/api/grids-api.port';
import { OrderDto } from '@components/grids/api/dto/order.dto';
import {
    EXCHANGE_PORT,
    ExchangePort,
} from '@components/trading/core/application/ports/exchange.port';

/**
 * Cancels an order of a grid that is being torn down: on the exchange first, then in the DB.
 *
 * The DB row is marked Cancelled even when the exchange rejects the cancel or the call throws —
 * a teardown must not wedge on one order, and an order the exchange never knew about (no
 * exchangeOrderId) only exists in the DB. Shared by StopGridUseCase and LeftoverOrderSweepService.
 */
@Injectable()
export class OrderCancellationService {
    private readonly logger = logger.child({ context: OrderCancellationService.name });

    constructor(
        @Inject(GRIDS_API_PORT) private readonly grids: GridsApiPort,
        @Inject(EXCHANGE_PORT) private readonly exchange: ExchangePort,
    ) {}

    async cancelOrder(order: OrderDto, accountAddress: string): Promise<void> {
        if (!order.exchangeOrderId) {
            await this.grids.updateOrderStatus(order.id, OrderStatus.Cancelled);
            return;
        }

        try {
            const result = await this.exchange.cancelSpotOrder({
                symbol: TradingSymbol.create(order.symbol),
                exchangeOrderId: order.exchangeOrderId,
                accountAddress,
            });

            if (!result.success) {
                this.logger.warn(
                    { orderId: order.id, error: result.error },
                    'Exchange cancel failed, marking order as cancelled in DB',
                );
            }
        } catch (err) {
            this.logger.warn({ err, orderId: order.id }, 'Failed to cancel order on exchange');
        }

        await this.grids.updateOrderStatus(order.id, OrderStatus.Cancelled);
    }
}
