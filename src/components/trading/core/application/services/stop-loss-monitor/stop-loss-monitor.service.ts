import { Injectable } from '@nestjs/common';
import { logger } from '@/infra/logger/logger';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { StopLossWatcherService } from '@components/trading/core/domain/services/stop-loss-watcher/stop-loss-watcher.service';
import { StopLossWatchDecision } from '@components/trading/core/domain/services/stop-loss-watcher/types/stop-loss-watch-decision';
import { TriggerStopLossUseCase } from '@components/trading/core/application/use-cases/trigger-stop-loss/trigger-stop-loss.use-case';

@Injectable()
export class StopLossMonitorService {
    private readonly logger = logger.child({ context: StopLossMonitorService.name });

    constructor(
        private readonly watcher: StopLossWatcherService,
        private readonly triggerStopLoss: TriggerStopLossUseCase,
    ) {}

    /**
     * Evaluate the stop-loss condition for a single grid. Returns `true` if a
     * stop-loss was triggered (caller should skip further processing for this
     * grid in the current polling iteration), `false` otherwise.
     */
    async processGrid(
        grid: GridDto,
        currentPrice: number,
        accountAddress: string,
    ): Promise<boolean> {
        if (!grid.stopLossEnabled || grid.stopLossTriggeredAt) {
            return false;
        }

        const decision = this.watcher.evaluate({
            gridId: grid.id,
            stopLossEnabled: grid.stopLossEnabled,
            stopLossPrice: grid.stopLossPrice ?? null,
            currentPrice,
            now: Date.now(),
        });

        if (decision !== StopLossWatchDecision.Trigger) {
            return false;
        }

        this.logger.warn(
            {
                gridId: grid.id,
                symbol: grid.symbol,
                currentPrice,
                stopLossPrice: grid.stopLossPrice,
            },
            'Stop-loss condition confirmed — initiating teardown',
        );

        await this.triggerStopLoss.execute({
            gridId: grid.id,
            symbol: grid.symbol,
            stopLossPrice: grid.stopLossPrice!,
            accountAddress,
        });

        return true;
    }
}
