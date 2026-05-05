import { Inject, Injectable } from '@nestjs/common';
import { logger } from '@/infra/logger/logger';
import { GridStatus } from '@domain/models/grid/grid-status';
import { OrderStatus } from '@domain/models/order/order-status';
import { GRIDS_API_PORT, GridsApiPort } from '@components/grids/api/grids-api.port';
import {
    EXCHANGE_PORT,
    ExchangePort,
} from '@components/trading/core/application/ports/exchange.port';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { OrderDto } from '@components/grids/api/dto/order.dto';

@Injectable()
export class StopGridUseCase {
    private readonly logger = logger.child({ context: StopGridUseCase.name });

    constructor(
        @Inject(GRIDS_API_PORT) private readonly grids: GridsApiPort,
        @Inject(EXCHANGE_PORT) private readonly exchange: ExchangePort,
    ) {}

    async execute(gridId: string, accountAddress: string): Promise<void> {
        const grid = await this.grids.findGridById(gridId);

        if (!grid) {
            this.logger.warn({ gridId }, 'Grid not found for stop command');
            return;
        }

        this.logger.info({ gridId, symbol: grid.symbol }, 'Stopping grid');

        const activeOrders = await this.grids.findActiveOrdersByGridId(gridId);
        for (const order of activeOrders) {
            await this.cancelOrder(order, accountAddress);
        }

        await this.grids.updateGridStatus(gridId, GridStatus.Stopped);

        this.logger.info(
            { gridId, cancelledOrders: activeOrders.length },
            'Grid stopped successfully',
        );
    }

    private async cancelOrder(order: OrderDto, accountAddress: string): Promise<void> {
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
        } catch (error) {
            this.logger.warn(
                { error, orderId: order.id },
                'Failed to cancel order on exchange during grid stop',
            );
        }

        await this.grids.updateOrderStatus(order.id, OrderStatus.Cancelled);
    }
}
