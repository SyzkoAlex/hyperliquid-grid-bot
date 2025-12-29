import { Injectable } from '@nestjs/common';
import { PostgresOrderRepository } from '../../../secondary/repository/order/postgres-order.repository';
import { OrderStatusSyncService } from '../order-status-sync/order-status-sync.service';
import { OrderRefillService } from '../order-refill/order-refill.service';
import { ExchangeOpenOrder } from '../../domain/exchange-order/exchange-open-order';
import { Grid } from '../../domain/grid/grid';
import { logger } from '../../../../../infra/logger/logger';
import { GridProcessResult } from './grid-process-result';

@Injectable()
export class GridProcessorService {
    private readonly logger = logger.child({ context: GridProcessorService.name });

    constructor(
        private readonly orderRepository: PostgresOrderRepository,
        private readonly orderStatusSyncService: OrderStatusSyncService,
        private readonly orderRefillService: OrderRefillService,
    ) {}

    async process(grid: Grid, exchangeOpenOrders: ExchangeOpenOrder[]): Promise<GridProcessResult> {
        const result = GridProcessResult.empty();

        const activeDbOrders = await this.orderRepository.findManyActive(grid.id);

        if (activeDbOrders.length === 0) {
            return result;
        }

        const statusSyncResult = await this.orderStatusSyncService.process(
            activeDbOrders,
            exchangeOpenOrders,
        );

        result.incrementFills(statusSyncResult.filled);

        // Process refills for filled orders
        for (const filledOrder of statusSyncResult.filledOrders) {
            const refillResult = await this.orderRefillService.process(filledOrder, grid);

            if (refillResult.success) {
                result.incrementRefills();
            }
        }

        return result;
    }
}
