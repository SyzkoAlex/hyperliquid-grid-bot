import { Injectable } from '@nestjs/common';
import { logger } from '@/infra/logger/logger';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { StopLossWatcherService } from '@components/trading/core/application/services/stop-loss-watcher/stop-loss-watcher.service';
import { StopLossWatchDecision } from '@components/trading/core/application/services/stop-loss-watcher/types/stop-loss-watch-decision';

@Injectable()
export class StopLossMonitorService {
    private readonly logger = logger.child({ context: StopLossMonitorService.name });

    constructor(private readonly watcher: StopLossWatcherService) {}

    evaluateGrid(grid: GridDto, currentPrice: number): StopLossWatchDecision {
        if (!grid.stopLossEnabled || grid.stopLossTriggeredAt) {
            return StopLossWatchDecision.NoBreach;
        }

        const decision = this.watcher.evaluate({
            gridId: grid.id,
            stopLossEnabled: grid.stopLossEnabled,
            stopLossPrice: grid.stopLossPrice ?? null,
            currentPrice,
            now: Date.now(),
        });

        if (decision === StopLossWatchDecision.Trigger) {
            this.logger.warn(
                {
                    gridId: grid.id,
                    symbol: grid.symbol,
                    currentPrice,
                    stopLossPrice: grid.stopLossPrice,
                },
                'Stop-loss condition confirmed — initiating teardown',
            );
        }

        return decision;
    }
}
