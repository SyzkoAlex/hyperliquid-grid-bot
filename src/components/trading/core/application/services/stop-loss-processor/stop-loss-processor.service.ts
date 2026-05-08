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

        await this.executeTeardown(grid, accountAddress, currentMid);
        return true;
    }

    private async executeTeardown(
        grid: GridDto,
        accountAddress: string,
        currentMid: number,
    ): Promise<void> {
        // Sets status=Stopped and stop_loss_triggered_at so concurrent polls skip this grid.
        await this.grids.markStoppedByStopLoss(grid.id);
        const cancellationResult = await this.cancellation.cancelActiveOrders(
            grid.id,
            accountAddress,
        );

        const sellAmount = await this.balanceAttribution.computeSellAmount(grid, accountAddress);

        let result: StopLossMarketSellResult;
        if (sellAmount.lte(Decimal.zero())) {
            this.logger.info(
                { gridId: grid.id },
                'Nothing to sell — zero grid-attributable base balance',
            );
            result = { success: true, soldBaseAmount: 0, receivedUSDC: 0 };
        } else {
            const sellResult = await this.marketSell.execute({
                gridId: grid.id,
                symbol: grid.symbol,
                amount: sellAmount,
                currentMid,
                accountAddress,
            });
            result = this.appendCancelWarning(sellResult, cancellationResult, grid.id);
        }

        await this.eventPublisher.publish(
            new GridStopLossTriggeredEvent(
                grid.id,
                grid.symbol,
                grid.stopLossPrice!,
                currentMid,
                result.soldBaseAmount,
                result.receivedUSDC,
                result.success,
                result.errorMessage,
            ),
        );
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
