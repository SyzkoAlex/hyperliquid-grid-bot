import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HyperliquidOrderClient } from '../../../secondary/client/hyperliquid/hyperliquid-order.client';
import { PostgresGridRepository } from '../../../secondary/repository/grid/postgres-grid.repository';
import { GridProcessorService } from '../../services/grid-processor/grid-processor.service';
import { logger } from '../../../../../infra/logger/logger';
import { SyncOrdersResult } from './sync-orders-result';
import { Config } from '../../../../../infra/config/config.schema';
import { ExchangeOpenOrder } from '../../domain/exchange-order/exchange-open-order';
import { Grid } from '../../domain/grid/grid';

@Injectable()
export class SyncOrdersUseCase {
    private readonly logger = logger.child({ context: SyncOrdersUseCase.name });
    private readonly accountAddress: string;

    constructor(
        private readonly configService: ConfigService<Config, true>,
        private readonly hyperliquidOrderClient: HyperliquidOrderClient,
        private readonly gridRepository: PostgresGridRepository,
        private readonly gridProcessorService: GridProcessorService,
    ) {
        this.accountAddress = this.configService.get('hyperliquid', { infer: true }).accountAddress;
    }

    async execute(): Promise<SyncOrdersResult> {
        const result = SyncOrdersResult.empty();

        const activeGrids = await this.gridRepository.findManyActive();

        if (activeGrids.length === 0) {
            this.logger.debug('No active grids to sync');
            return result;
        }

        this.logger.debug({ activeGrids: activeGrids.length }, 'Syncing orders');

        // Fetch all open orders from exchange at once for all grids
        const allOpenOrders = await this.hyperliquidOrderClient.getOpenSpotOrders(
            this.accountAddress,
        );

        for (const grid of activeGrids) {
            try {
                const gridOpenOrders = this.getGridOpenOrders(allOpenOrders, grid);
                const gridResult = await this.gridProcessorService.process(grid, gridOpenOrders);

                result.update(gridResult);
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                result.errors.push(`Grid ${grid.id.toString()}: ${errorMsg}`);
                this.logger.error({ error, gridId: grid.id.toString() }, 'Error processing grid');
            }
        }

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

        return result;
    }

    // Filter open orders for this specific grid
    private getGridOpenOrders(allOpenOrders: ExchangeOpenOrder[], grid: Grid) {
        return allOpenOrders.filter((o) => o.cloid?.toGridId()?.equals(grid.id));
    }
}
