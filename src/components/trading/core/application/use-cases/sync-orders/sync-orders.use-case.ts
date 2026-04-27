import { Inject, Injectable } from '@nestjs/common';
import {
    EXCHANGE_PORT,
    ExchangePort,
} from '@components/trading/core/application/ports/exchange.port';
import { GRIDS_API_PORT, GridsApiPort } from '@components/grids/api/grids-api.port';
import { OrderStatusSyncService } from '@components/trading/core/application/services/order-status-sync/order-status-sync.service';
import { OrderRefillService } from '@components/trading/core/application/services/order-refill/order-refill.service';
import { logger } from '@/infra/logger/logger';
import { SyncOrdersResult } from './sync-orders-result';
import { GridWithOrders } from './grid-with-orders';

@Injectable()
export class SyncOrdersUseCase {
    private readonly logger = logger.child({ context: SyncOrdersUseCase.name });

    constructor(
        @Inject(EXCHANGE_PORT) private readonly exchange: ExchangePort,
        @Inject(GRIDS_API_PORT) private readonly grids: GridsApiPort,
        private readonly orderStatusSyncService: OrderStatusSyncService,
        private readonly orderRefillService: OrderRefillService,
    ) {}

    async execute(accountAddress: string, userId: string): Promise<SyncOrdersResult> {
        const result = SyncOrdersResult.empty();

        const exchangeOpenOrders = await this.exchange.getOpenSpotOrders(accountAddress);

        const activeGrids = await this.grids.findActiveGridsByUserId(userId);
        if (activeGrids.length === 0) {
            return result;
        }

        // Fetch all placed orders for active grids
        const gridIds = activeGrids.map((grid) => grid.id);
        const allActiveDbOrders = await this.grids.findPlacedOrdersByGridIds(gridIds);
        if (allActiveDbOrders.length === 0) {
            return result;
        }

        const gridsWithOrders = GridWithOrders.buildMany(
            activeGrids,
            allActiveDbOrders,
            exchangeOpenOrders,
        );

        this.logger.debug(
            { activeGrids: gridsWithOrders.length, openOrders: exchangeOpenOrders.length },
            'Syncing orders',
        );

        for (const gridWithOrders of gridsWithOrders) {
            await this.processGrid(gridWithOrders, accountAddress, result);
        }

        this.logResultIfNeeded(result);
        return result;
    }

    private async processGrid(
        gridWithOrders: GridWithOrders,
        accountAddress: string,
        result: SyncOrdersResult,
    ): Promise<void> {
        try {
            const statusSyncResult = await this.orderStatusSyncService.process(
                gridWithOrders.dbOrders,
                gridWithOrders.exchangeOrders,
                accountAddress,
            );

            const refillsPlaced = await this.orderRefillService.processMany(
                statusSyncResult.filledOrders,
                gridWithOrders.grid,
                accountAddress,
            );

            result.update({ fills: statusSyncResult.filled, refills: refillsPlaced });
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            result.errors.push(`Grid ${gridWithOrders.grid.id}: ${errorMsg}`);
            this.logger.error({ error, gridId: gridWithOrders.grid.id }, 'Error processing grid');
        }
    }

    private logResultIfNeeded(result: SyncOrdersResult): void {
        if (result.fillsDetected) {
            this.logger.info(
                {
                    gridsProcessed: result.gridsProcessed,
                    fillsDetected: result.fillsDetected,
                    refillsPlaced: result.refillsPlaced,
                },
                'Orders sync completed',
            );
        }
    }
}
