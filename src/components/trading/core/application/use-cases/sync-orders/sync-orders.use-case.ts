import { Inject, Injectable } from '@nestjs/common';
import {
    EXCHANGE_PORT,
    ExchangePort,
} from '@components/trading/core/application/ports/exchange.port';
import { GRIDS_API_PORT, GridsApiPort } from '@components/grids/api/grids-api.port';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { ExchangeOpenOrder } from '@components/trading/core/domain/models/exchange-order/exchange-open-order';
import { OrderStatusSyncService } from '@components/trading/core/application/services/order-status-sync/order-status-sync.service';
import { OrderRefillService } from '@components/trading/core/application/services/order-refill/order-refill.service';
import { StpRecoveryService } from '@components/trading/core/application/services/stp-recovery/stp-recovery.service';
import { StopLossProcessorService } from '@components/trading/core/application/services/stop-loss-processor/stop-loss-processor.service';
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
        private readonly stpRecoveryService: StpRecoveryService,
        private readonly stopLossProcessor: StopLossProcessorService,
    ) {}

    async execute(accountAddress: string, userId: string): Promise<SyncOrdersResult> {
        const exchangeOpenOrders = await this.exchange.getOpenSpotOrders(accountAddress);
        const activeGrids = await this.grids.findActiveGridsByUserId(userId);

        if (activeGrids.length === 0) return SyncOrdersResult.empty();

        return this.executeForGrids(accountAddress, activeGrids, exchangeOpenOrders);
    }

    async executeForGrids(
        accountAddress: string,
        activeGrids: GridDto[],
        exchangeOpenOrders: ExchangeOpenOrder[],
        priceBySymbol?: Map<string, number>,
    ): Promise<SyncOrdersResult> {
        const result = SyncOrdersResult.empty();
        if (activeGrids.length === 0) return result;

        // SL evaluation runs for ALL active grids regardless of whether they
        // have any DB orders — a grid with no open orders may still need SL teardown.
        const stoppedByLossIds = await this.runStopLossCheck(
            activeGrids,
            accountAddress,
            priceBySymbol,
        );

        const gridIds = activeGrids.map((g) => g.id);
        const allActiveDbOrders = await this.grids.findPlacedOrdersByGridIds(gridIds);
        if (allActiveDbOrders.length === 0) return result;

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
            // Skip order processing for grids whose SL was just triggered.
            if (stoppedByLossIds.has(gridWithOrders.grid.id)) continue;
            await this.processGrid(gridWithOrders, accountAddress, result);
        }

        this.logResultIfNeeded(result);
        return result;
    }

    /**
     * Runs stop-loss evaluation for all active grids and returns the set of grid IDs
     * for which teardown was initiated (so order processing can be skipped this tick).
     */
    private async runStopLossCheck(
        activeGrids: GridDto[],
        accountAddress: string,
        priceBySymbol?: Map<string, number>,
    ): Promise<Set<string>> {
        const stoppedByLossIds = new Set<string>();

        // priceBySymbol is absent on the legacy execute() path which does not pre-fetch prices.
        // Stop-loss evaluation is intentionally skipped — callers that need SL must use
        // executeForGrids with a pre-built price map (see OrdersPollingAdapter).
        if (!priceBySymbol) {
            const slGrids = activeGrids.filter((g) => g.stopLossEnabled && !g.stopLossTriggeredAt);
            if (slGrids.length > 0) {
                this.logger.warn(
                    { slGridIds: slGrids.map((g) => g.id) },
                    'priceBySymbol not provided — stop-loss evaluation skipped for grids with stopLossEnabled',
                );
            }
            return stoppedByLossIds;
        }

        for (const grid of activeGrids) {
            const currentPrice = priceBySymbol.get(grid.symbol);
            if (currentPrice === undefined) continue;

            try {
                const triggered = await this.stopLossProcessor.process(
                    grid,
                    accountAddress,
                    currentPrice,
                    Date.now(),
                );
                if (triggered) stoppedByLossIds.add(grid.id);
            } catch (error) {
                this.logger.error(
                    { error, gridId: grid.id },
                    'Error during stop-loss evaluation/trigger',
                );
            }
        }

        return stoppedByLossIds;
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

            const stpRecovered = await this.stpRecoveryService.recoverMany(
                statusSyncResult.stpCancelledOrders,
                gridWithOrders.grid,
                accountAddress,
            );

            result.update({ fills: statusSyncResult.filled, refills: refillsPlaced, stpRecovered });
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            result.errors.push(`Grid ${gridWithOrders.grid.id}: ${errorMsg}`);
            this.logger.error({ error, gridId: gridWithOrders.grid.id }, 'Error processing grid');
        }
    }

    private logResultIfNeeded(result: SyncOrdersResult): void {
        if (result.fillsDetected > 0 || result.stpRecovered > 0) {
            this.logger.info(
                {
                    gridsProcessed: result.gridsProcessed,
                    fillsDetected: result.fillsDetected,
                    refillsPlaced: result.refillsPlaced,
                    stpRecovered: result.stpRecovered,
                },
                'Orders sync completed',
            );
        }
    }
}
