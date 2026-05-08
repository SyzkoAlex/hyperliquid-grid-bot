import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Config } from '@/config/config.schema';
import { StopLossBreachState } from '../types/stop-loss-breach-state';
import { StopLossBreachStateCacheService } from '../breach-state-cache/stop-loss-breach-state-cache.service';

@Injectable()
export class StopLossBreachEvaluatorService {
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

    /**
     * Returns true when the price has been sufficiently below stopLossPrice
     * for the required confirmation duration. Clears breach state after firing.
     */
    async evaluate(
        gridId: string,
        stopLossPrice: number,
        currentMid: number,
        now: number,
    ): Promise<boolean> {
        if (currentMid > stopLossPrice) {
            await this.breachCache.delete(gridId);
            return false;
        }

        const penetrationThreshold = stopLossPrice * (1 - this.penetrationPct);
        if (currentMid > penetrationThreshold) return false;

        const existing = await this.breachCache.get(gridId);
        if (!existing) {
            await this.breachCache.set(gridId, new StopLossBreachState(now), this.breachTtlSeconds);
        }

        const state = existing ?? new StopLossBreachState(now);
        const elapsed = now - state.firstBreachAt;

        if (elapsed < this.confirmDurationMs) return false;

        await this.breachCache.delete(gridId);
        return true;
    }
}
