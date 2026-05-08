import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Config } from '@/config/config.schema';
import { StopLossWatchDecision } from './types/stop-loss-watch-decision';
import { StopLossBreachState } from './types/stop-loss-breach-state';
import { StopLossEvaluateInput } from './types/stop-loss-evaluate-input';
import { StopLossBreachStateCacheService } from './breach-state-cache/stop-loss-breach-state-cache.service';

@Injectable()
export class StopLossWatcherService {
    private readonly confirmDurationMs: number;
    private readonly penetrationPct: number;
    private readonly breachTtlSeconds: number;

    constructor(
        private readonly breachCache: StopLossBreachStateCacheService,
        config: ConfigService<Config, true>,
    ) {
        const { confirmDurationMs, penetrationPct, breachTtlSeconds } = config.get('stopLoss', {
            infer: true,
        });
        this.confirmDurationMs = confirmDurationMs;
        this.penetrationPct = penetrationPct;
        this.breachTtlSeconds = breachTtlSeconds;
    }

    async evaluate(input: StopLossEvaluateInput): Promise<StopLossWatchDecision> {
        const { gridId, stopLossEnabled, stopLossPrice, currentPrice, now } = input;

        if (!stopLossEnabled || stopLossPrice === null) {
            return StopLossWatchDecision.NoBreach;
        }

        if (currentPrice > stopLossPrice) {
            await this.breachCache.delete(gridId);
            return StopLossWatchDecision.NoBreach;
        }

        const penetrationThreshold = stopLossPrice * (1 - this.penetrationPct);
        if (currentPrice > penetrationThreshold) {
            return StopLossWatchDecision.NoBreach;
        }

        const existing = await this.breachCache.get(gridId);
        if (!existing) {
            await this.breachCache.set(gridId, new StopLossBreachState(now), this.breachTtlSeconds);
        }

        const state = existing ?? new StopLossBreachState(now);
        const elapsed = now - state.firstBreachAt;

        if (elapsed < this.confirmDurationMs) {
            return StopLossWatchDecision.BreachUnconfirmed;
        }

        await this.breachCache.delete(gridId);
        return StopLossWatchDecision.Trigger;
    }

    async clear(gridId: string): Promise<void> {
        await this.breachCache.delete(gridId);
    }
}
