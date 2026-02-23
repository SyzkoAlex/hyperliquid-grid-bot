import { Inject, Injectable } from '@nestjs/common';
import { GridId } from '@domain/models/grid/grid-id';
import { logger } from '@/infra/logger/logger';
import { GRIDS_PORT, GridsPort } from '@components/grids/core/application/ports/grids.port';
import {
    EXCHANGE_CLIENT_PORT,
    ExchangeClientPort,
} from '@components/trading/core/application/ports/exchange-client.port';

@Injectable()
export class StopGridUseCase {
    private readonly logger = logger.child({ context: StopGridUseCase.name });

    constructor(
        @Inject(GRIDS_PORT) private readonly grids: GridsPort,
        @Inject(EXCHANGE_CLIENT_PORT) private readonly orderClient: ExchangeClientPort,
    ) {}

    async execute(gridId: string): Promise<void> {
        const id = GridId.from(gridId);
        const grid = await this.grids.findGridById(id);

        if (!grid) {
            this.logger.warn({ gridId }, 'Grid not found for stop command');
            return;
        }

        this.logger.info({ gridId, symbol: grid.symbol.toString() }, 'Stopping grid');

        const activeOrders = await this.grids.findActiveOrdersByGridId(id);
        for (const order of activeOrders) {
            if (!order.exchangeOrderId) continue;
            try {
                await this.orderClient.cancelSpotOrder({
                    symbol: order.symbol,
                    exchangeOrderId: order.exchangeOrderId,
                });
            } catch (error) {
                this.logger.warn(
                    { error, orderId: order.id.toString() },
                    'Failed to cancel order during grid stop',
                );
            }
        }

        grid.stop();
        await this.grids.saveGrid(grid);

        this.logger.info({ gridId }, 'Grid stopped successfully');
    }
}
