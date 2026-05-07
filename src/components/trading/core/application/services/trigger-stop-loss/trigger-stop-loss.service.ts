import { Inject, Injectable } from '@nestjs/common';
import { logger } from '@/infra/logger/logger';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Decimal } from '@domain/models/primitives/decimal';
import { GRIDS_API_PORT, GridsApiPort } from '@components/grids/api/grids-api.port';
import {
    EVENT_PUBLISHER_PORT,
    EventPublisherPort,
} from '@/core/application/ports/outbound/event-publisher.port';
import { GridStopLossTriggeredEvent } from '@domain/models/events/trading/grid-stop-loss-triggered.event';
import { StopLossOrderCancellationService } from './order-cancellation/stop-loss-order-cancellation.service';
import { StopLossBalanceAttributionService } from './balance-attribution/stop-loss-balance-attribution.service';
import { StopLossMarketSellService } from './market-sell/stop-loss-market-sell.service';
import { TriggerStopLossParams } from './trigger-stop-loss-params';
import { TriggerStopLossResult } from './trigger-stop-loss-result';

@Injectable()
export class TriggerStopLossService {
    private readonly logger = logger.child({ context: TriggerStopLossService.name });

    constructor(
        @Inject(GRIDS_API_PORT) private readonly grids: GridsApiPort,
        @Inject(EVENT_PUBLISHER_PORT) private readonly eventPublisher: EventPublisherPort,
        private readonly cancellation: StopLossOrderCancellationService,
        private readonly balanceAttribution: StopLossBalanceAttributionService,
        private readonly marketSell: StopLossMarketSellService,
    ) {}

    async execute(params: TriggerStopLossParams): Promise<TriggerStopLossResult> {
        const { gridId, symbol, stopLossPrice, currentMid, accountAddress } = params;

        this.logger.info(
            { gridId, symbol, stopLossPrice, currentMid },
            'Stop-loss triggered — starting teardown',
        );

        // Atomically set status=Stopped and stop_loss_triggered_at so concurrent
        // polls skip this grid and order refill is suppressed.
        await this.grids.markStoppedByStopLoss(gridId);

        const cancellationResult = await this.cancellation.cancelActiveOrders(
            gridId,
            accountAddress,
        );

        const grid = await this.grids.findGridById(gridId);

        if (!grid) {
            this.logger.error(
                { gridId },
                'Grid not found after teardown — cannot compute sell amount',
            );
            const event = this.buildEvent(params, 0, 0, false, `Grid ${gridId} not found`);
            await this.eventPublisher.publish(event);
            return {
                success: false,
                soldBaseAmount: 0,
                receivedUSDC: 0,
                errorMessage: `Grid ${gridId} not found`,
            };
        }

        const allActiveGrids = await this.grids.findActiveGrids();
        const allActiveGridsOnSymbol = allActiveGrids.filter((g) => g.symbol === symbol);

        const sellAmount = await this.balanceAttribution.computeSellAmount(
            gridId,
            grid,
            accountAddress,
            TradingSymbol.create(symbol),
            allActiveGridsOnSymbol,
        );

        if (sellAmount.lte(Decimal.zero())) {
            this.logger.info({ gridId }, 'Nothing to sell — zero grid-attributable base balance');
            const event = this.buildEvent(params, 0, 0, true, undefined);
            await this.eventPublisher.publish(event);
            return { success: true, soldBaseAmount: 0, receivedUSDC: 0 };
        }

        const result = await this.marketSell.execute({
            gridId,
            symbol,
            amount: sellAmount,
            currentMid,
            accountAddress,
        });

        let errorMessage = result.errorMessage;
        if (cancellationResult.failedCount > 0) {
            const cancelWarning =
                `${cancellationResult.failedCount} order(s) could not be cancelled on the exchange — ` +
                `manual review required.`;
            this.logger.warn(
                { gridId, failedCount: cancellationResult.failedCount },
                cancelWarning,
            );
            errorMessage = errorMessage ? `${errorMessage} ${cancelWarning}` : cancelWarning;
        }

        await this.eventPublisher.publish(
            this.buildEvent(
                params,
                result.soldBaseAmount,
                result.receivedUSDC,
                result.success,
                errorMessage,
            ),
        );

        return { ...result, errorMessage };
    }

    private buildEvent(
        params: TriggerStopLossParams,
        soldBaseAmount: number,
        receivedUSDC: number,
        success: boolean,
        errorMessage: string | undefined,
    ): GridStopLossTriggeredEvent {
        return new GridStopLossTriggeredEvent(
            params.gridId,
            params.symbol,
            params.stopLossPrice,
            params.currentMid,
            soldBaseAmount,
            receivedUSDC,
            success,
            errorMessage,
        );
    }
}
