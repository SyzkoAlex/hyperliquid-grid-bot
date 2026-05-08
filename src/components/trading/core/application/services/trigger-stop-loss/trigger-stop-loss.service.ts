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
import { CancelActiveOrdersResult } from './order-cancellation/types/cancel-active-orders-result';
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
        const { gridId, symbol, stopLossPrice, currentMid } = params;

        this.logger.info(
            { gridId, symbol, stopLossPrice, currentMid },
            'Stop-loss triggered — starting teardown',
        );

        const cancellationResult = await this.stopAndCancelOrders(params);
        const sellAmount = await this.resolveSellAmount(params);

        if (!sellAmount) {
            return this.publishAndReturn(params, {
                success: false,
                soldBaseAmount: 0,
                receivedUSDC: 0,
                errorMessage: `Grid ${gridId} not found`,
            });
        }

        if (sellAmount.lte(Decimal.zero())) {
            this.logger.info({ gridId }, 'Nothing to sell — zero grid-attributable base balance');
            return this.publishAndReturn(params, {
                success: true,
                soldBaseAmount: 0,
                receivedUSDC: 0,
            });
        }

        const sellResult = await this.marketSell.execute({
            gridId,
            symbol,
            amount: sellAmount,
            currentMid: params.currentMid,
            accountAddress: params.accountAddress,
        });

        return this.publishAndReturn(
            params,
            this.appendCancelWarning(sellResult, cancellationResult, gridId),
        );
    }

    private async stopAndCancelOrders(
        params: TriggerStopLossParams,
    ): Promise<CancelActiveOrdersResult> {
        // Sets status=Stopped and stop_loss_triggered_at so concurrent polls skip this grid.
        await this.grids.markStoppedByStopLoss(params.gridId);
        return this.cancellation.cancelActiveOrders(params.gridId, params.accountAddress);
    }

    private async resolveSellAmount(params: TriggerStopLossParams): Promise<Decimal | null> {
        const { gridId, symbol, accountAddress } = params;

        const grid = await this.grids.findGridById(gridId);
        if (!grid) {
            this.logger.error(
                { gridId },
                'Grid not found after teardown — cannot compute sell amount',
            );
            return null;
        }

        const allActiveGrids = await this.grids.findActiveGrids();
        const allActiveGridsOnSymbol = allActiveGrids.filter((g) => g.symbol === symbol);

        return this.balanceAttribution.computeSellAmount(
            gridId,
            grid,
            accountAddress,
            TradingSymbol.create(symbol),
            allActiveGridsOnSymbol,
        );
    }

    private appendCancelWarning(
        result: TriggerStopLossResult,
        cancellationResult: CancelActiveOrdersResult,
        gridId: string,
    ): TriggerStopLossResult {
        if (cancellationResult.failedCount === 0) return result;

        const cancelWarning = `${cancellationResult.failedCount} order(s) could not be cancelled on the exchange — manual review required.`;
        this.logger.warn({ gridId, failedCount: cancellationResult.failedCount }, cancelWarning);
        const errorMessage = result.errorMessage
            ? `${result.errorMessage} ${cancelWarning}`
            : cancelWarning;
        return { ...result, errorMessage };
    }

    private async publishAndReturn(
        params: TriggerStopLossParams,
        result: TriggerStopLossResult,
    ): Promise<TriggerStopLossResult> {
        await this.eventPublisher.publish(
            new GridStopLossTriggeredEvent(
                params.gridId,
                params.symbol,
                params.stopLossPrice,
                params.currentMid,
                result.soldBaseAmount,
                result.receivedUSDC,
                result.success,
                result.errorMessage,
            ),
        );
        return result;
    }
}
