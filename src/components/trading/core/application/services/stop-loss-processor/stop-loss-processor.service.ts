import { Inject, Injectable } from '@nestjs/common';
import { logger } from '@/infra/logger/logger';
import { Decimal } from '@domain/models/primitives/decimal';
import { GRIDS_API_PORT, GridsApiPort } from '@components/grids/api/grids-api.port';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import {
    EVENT_PUBLISHER_PORT,
    EventPublisherPort,
} from '@/core/application/ports/outbound/event-publisher.port';
import { GridStopLossTriggeredEvent } from '@domain/models/events/trading/grid-stop-loss-triggered.event';
import { StopLossBreachEvaluatorService } from './breach-evaluator/stop-loss-breach-evaluator.service';
import { StopLossOrderCancellationService } from './order-cancellation/stop-loss-order-cancellation.service';
import { StopLossBalanceAttributionService } from './balance-attribution/stop-loss-balance-attribution.service';
import { StopLossMarketSellService } from './market-sell/stop-loss-market-sell.service';
import { CancelActiveOrdersResult } from './order-cancellation/types/cancel-active-orders-result';
import { StopLossMarketSellResult } from './market-sell/types/stop-loss-market-sell-result';

@Injectable()
export class StopLossProcessorService {
    private readonly logger = logger.child({ context: StopLossProcessorService.name });

    constructor(
        private readonly breachEvaluator: StopLossBreachEvaluatorService,
        @Inject(GRIDS_API_PORT) private readonly grids: GridsApiPort,
        @Inject(EVENT_PUBLISHER_PORT) private readonly eventPublisher: EventPublisherPort,
        private readonly cancellation: StopLossOrderCancellationService,
        private readonly balanceAttribution: StopLossBalanceAttributionService,
        private readonly marketSell: StopLossMarketSellService,
    ) {}

    /**
     * Evaluates breach conditions and, if confirmed, executes stop-loss teardown.
     * Returns true if teardown was initiated.
     */
    async process(
        grid: GridDto,
        accountAddress: string,
        currentMid: number,
        now: number,
        allActiveGrids: GridDto[] = [],
    ): Promise<boolean> {
        if (!grid.stopLossEnabled || !grid.stopLossPrice || grid.stopLossTriggeredAt) return false;

        const triggered = await this.breachEvaluator.evaluate(
            grid.id,
            grid.stopLossPrice,
            currentMid,
            now,
        );
        if (!triggered) return false;

        this.logger.warn(
            { gridId: grid.id, symbol: grid.symbol, currentMid, stopLossPrice: grid.stopLossPrice },
            'Stop-loss condition confirmed — initiating teardown',
        );

        await this.executeTeardown(
            grid,
            grid.stopLossPrice,
            accountAddress,
            currentMid,
            allActiveGrids,
        );
        return true;
    }

    private async executeTeardown(
        grid: GridDto,
        stopLossPrice: number,
        accountAddress: string,
        currentMid: number,
        allActiveGrids: GridDto[] = [],
    ): Promise<void> {
        await this.grids.markStoppedByStopLoss(grid.id);

        try {
            const cancellationResult = await this.cancellation.cancelActiveOrders(
                grid.id,
                accountAddress,
            );

            const otherActiveGrids = allActiveGrids.filter((g) => g.id !== grid.id);
            const sellAmount = await this.balanceAttribution.computeSellAmount(
                grid,
                accountAddress,
                otherActiveGrids,
            );

            let result: StopLossMarketSellResult;
            if (sellAmount.lte(Decimal.zero())) {
                this.logger.info(
                    { gridId: grid.id },
                    'Nothing to sell — zero grid-attributable base balance',
                );
                result = { success: true, soldBaseAmount: 0, receivedUSDC: 0 };
            } else {
                result = await this.marketSell.execute({
                    gridId: grid.id,
                    symbol: grid.symbol,
                    amount: sellAmount,
                    currentMid,
                    accountAddress,
                });
            }

            result = this.appendCancelWarning(result, cancellationResult, grid.id);

            await this.eventPublisher.publish(
                new GridStopLossTriggeredEvent(
                    grid.userId,
                    grid.id,
                    grid.symbol,
                    stopLossPrice,
                    currentMid,
                    result.soldBaseAmount,
                    result.receivedUSDC,
                    result.success,
                    result.errorMessage,
                ),
            );
        } catch (error) {
            this.logger.error(
                { error, gridId: grid.id },
                'Stop-loss teardown failed after marking grid stopped — publishing failure event',
            );
            await this.eventPublisher.publish(
                new GridStopLossTriggeredEvent(
                    grid.userId,
                    grid.id,
                    grid.symbol,
                    stopLossPrice,
                    currentMid,
                    0,
                    0,
                    false,
                    `Teardown error: ${error instanceof Error ? error.message : String(error)}`,
                ),
            );
        }
    }

    private appendCancelWarning(
        result: StopLossMarketSellResult,
        cancellationResult: CancelActiveOrdersResult,
        gridId: string,
    ): StopLossMarketSellResult {
        if (cancellationResult.failedCount === 0) return result;

        const cancelWarning = `${cancellationResult.failedCount} order(s) could not be cancelled on the exchange — manual review required.`;
        this.logger.warn({ gridId, failedCount: cancellationResult.failedCount }, cancelWarning);
        const errorMessage = result.errorMessage
            ? `${result.errorMessage} ${cancelWarning}`
            : cancelWarning;
        return { ...result, errorMessage };
    }
}
