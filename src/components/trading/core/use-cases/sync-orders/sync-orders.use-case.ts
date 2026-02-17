import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HyperliquidOrderClient } from '../../../secondary/client/hyperliquid/hyperliquid-order.client';
import { PostgresGridRepository } from '../../../secondary/repository/grid/postgres-grid.repository';
import { PostgresOrderRepository } from '../../../secondary/repository/order/postgres-order.repository';
import { OrderStatusSyncService } from '../../services/order-status-sync/order-status-sync.service';
import { OrderRefillService } from '../../services/order-refill/order-refill.service';
import { logger } from '../../../../../infra/logger/logger';
import { SyncOrdersResult } from './sync-orders-result';
import { Config } from '../../../../../infra/config/config.schema';
import { GridWithOrders } from './grid-with-orders';

@Injectable()
export class SyncOrdersUseCase {
    private readonly logger = logger.child({ context: SyncOrdersUseCase.name });
    private readonly accountAddress: string;

    constructor(
        private readonly configService: ConfigService<Config, true>,
        private readonly hyperliquidOrderClient: HyperliquidOrderClient,
        private readonly gridRepository: PostgresGridRepository,
        private readonly orderRepository: PostgresOrderRepository,
        private readonly orderStatusSyncService: OrderStatusSyncService,
        private readonly orderRefillService: OrderRefillService,
    ) {
        this.accountAddress = this.configService.get('hyperliquid', { infer: true }).accountAddress;
    }

    async execute(): Promise<SyncOrdersResult> {
        const result = SyncOrdersResult.empty();

        const exchangeOpenOrders = await this.hyperliquidOrderClient.getOpenSpotOrders(
            this.accountAddress,
        );

        // Fetch all active grids
        const activeGrids = await this.gridRepository.findManyActive();
        if (activeGrids.length === 0) {
            return result;
        }

        // Fetch all placed orders for active grids
        const gridIds = activeGrids.map((grid) => grid.id.toString());
        const allActiveDbOrders = await this.orderRepository.findManyPlacedByGridIds(gridIds);
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
            await this.processGrid(gridWithOrders, result);
        }

        this.logResultIfNeeded(result);
        return result;
    }

    private async processGrid(
        gridWithOrders: GridWithOrders,
        result: SyncOrdersResult,
    ): Promise<void> {
        try {
            const statusSyncResult = await this.orderStatusSyncService.process(
                gridWithOrders.dbOrders,
                gridWithOrders.exchangeOrders,
            );

            const refillsPlaced = await this.orderRefillService.processMany(
                statusSyncResult.filledOrders,
                gridWithOrders.grid,
            );

            result.update({ fills: statusSyncResult.filled, refills: refillsPlaced });
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            result.errors.push(`Grid ${gridWithOrders.grid.id.toString()}: ${errorMsg}`);
            this.logger.error(
                { error, gridId: gridWithOrders.grid.id.toString() },
                'Error processing grid',
            );
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
