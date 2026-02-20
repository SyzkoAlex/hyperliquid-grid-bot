import { Inject, Injectable } from '@nestjs/common';
import { GridId } from '@domain/models/grid/grid-id';
import { logger } from '@infra/logger/logger';
import {
    GRID_REPOSITORY_PORT,
    GridRepositoryPort,
} from '@components/trading/domain/ports/outbound/grid-repository.port';
import {
    ORDER_REPOSITORY_PORT,
    OrderRepositoryPort,
} from '@components/trading/domain/ports/outbound/order-repository.port';
import {
    EXCHANGE_CLIENT_PORT,
    ExchangeClientPort,
} from '@components/trading/domain/ports/outbound/exchange-client.port';

@Injectable()
export class StopGridUseCase {
    private readonly logger = logger.child({ context: StopGridUseCase.name });

    constructor(
        @Inject(GRID_REPOSITORY_PORT) private readonly gridRepository: GridRepositoryPort,
        @Inject(ORDER_REPOSITORY_PORT) private readonly orderRepository: OrderRepositoryPort,
        @Inject(EXCHANGE_CLIENT_PORT) private readonly orderClient: ExchangeClientPort,
    ) {}

    async execute(gridId: string): Promise<void> {
        const id = GridId.from(gridId);
        const grid = await this.gridRepository.findOneById(id);

        if (!grid) {
            this.logger.warn({ gridId }, 'Grid not found for stop command');
            return;
        }

        this.logger.info({ gridId, symbol: grid.symbol.toString() }, 'Stopping grid');

        const activeOrders = await this.orderRepository.findManyActive(id);
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
        await this.gridRepository.save(grid);

        this.logger.info({ gridId }, 'Grid stopped successfully');
    }
}
