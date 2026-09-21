import { Inject, Injectable } from '@nestjs/common';
import { logger } from '@/infra/logger/logger';
import { GridStatus } from '@domain/models/grid/grid-status';
import { GRIDS_API_PORT, GridsApiPort } from '@components/grids/api/grids-api.port';
import {
    EXCHANGE_PORT,
    ExchangePort,
} from '@components/trading/core/application/ports/exchange.port';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { OrderCancellationService } from '@components/trading/core/application/services/order-cancellation/order-cancellation.service';

@Injectable()
export class StopGridUseCase {
    private readonly logger = logger.child({ context: StopGridUseCase.name });

    constructor(
        @Inject(GRIDS_API_PORT) private readonly grids: GridsApiPort,
        @Inject(EXCHANGE_PORT) private readonly exchange: ExchangePort,
        private readonly orderCancellation: OrderCancellationService,
    ) {}

    async execute(userId: string, gridId: string, accountAddress: string): Promise<void> {
        const grid = await this.grids.findGridByIdForUser(userId, gridId);

        if (!grid) {
            this.logger.warn({ userId, gridId }, 'Grid not found for stop command');
            return;
        }

        this.logger.info({ gridId, symbol: grid.symbol }, 'Stopping grid');

        // Marked stopped first so that concurrent order placement stops; skipped for a grid that is
        // already stopped, so a stop interrupted before (or during) the cancel loop can be retried.
        if (grid.status !== GridStatus.Stopped) {
            const stopPrice = await this.fetchCurrentPriceSafe(grid.symbol);
            await this.grids.markStopped(gridId, stopPrice);
        }

        const activeOrders = await this.grids.findActiveOrdersByGridId(gridId);
        for (const order of activeOrders) {
            await this.orderCancellation.cancelOrder(order, accountAddress);
        }

        this.logger.info(
            { gridId, cancelledOrders: activeOrders.length },
            'Grid stopped successfully',
        );
    }

    private async fetchCurrentPriceSafe(symbol: string): Promise<number | undefined> {
        try {
            const price = await this.exchange.getCurrentPrice(TradingSymbol.create(symbol));
            return price.toNumber();
        } catch (error) {
            this.logger.warn(
                { error, symbol },
                'Failed to fetch current price for stop snapshot; proceeding without it',
            );
            return undefined;
        }
    }
}
