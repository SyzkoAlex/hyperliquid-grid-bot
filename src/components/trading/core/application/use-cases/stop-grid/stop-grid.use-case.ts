import { Inject, Injectable } from '@nestjs/common';
import { logger } from '@/infra/logger/logger';
import { GridStatus } from '@domain/models/grid/grid-status';
import { GRIDS_API_PORT, GridsApiPort } from '@components/grids/api/grids-api.port';
import {
    EXCHANGE_PORT,
    ExchangePort,
} from '@components/trading/core/application/ports/exchange.port';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';

@Injectable()
export class StopGridUseCase {
    private readonly logger = logger.child({ context: StopGridUseCase.name });

    constructor(
        @Inject(GRIDS_API_PORT) private readonly grids: GridsApiPort,
        @Inject(EXCHANGE_PORT) private readonly exchange: ExchangePort,
    ) {}

    async execute(gridId: string): Promise<void> {
        const grid = await this.grids.findGridById(gridId);

        if (!grid) {
            this.logger.warn({ gridId }, 'Grid not found for stop command');
            return;
        }

        this.logger.info({ gridId, symbol: grid.symbol }, 'Stopping grid');

        const activeOrders = await this.grids.findActiveOrdersByGridId(gridId);
        for (const order of activeOrders) {
            if (!order.exchangeOrderId) continue;
            try {
                await this.exchange.cancelSpotOrder({
                    symbol: TradingSymbol.create(order.symbol),
                    exchangeOrderId: order.exchangeOrderId,
                });
            } catch (error) {
                this.logger.warn(
                    { error, orderId: order.id },
                    'Failed to cancel order during grid stop',
                );
            }
        }

        await this.grids.updateGridStatus(gridId, GridStatus.Stopped);

        this.logger.info({ gridId }, 'Grid stopped successfully');
    }
}
