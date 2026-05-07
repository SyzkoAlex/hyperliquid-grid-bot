import { Inject, Injectable } from '@nestjs/common';
import { CACHE_PORT, CachePort } from '@/core/application/ports/outbound/cache.port';
import { StopLossWatchDecision } from './types/stop-loss-watch-decision';
import { StopLossBreachState } from './types/stop-loss-breach-state';
import { StopLossEvaluateInput } from './types/stop-loss-evaluate-input';

/**
 * Application service that decides whether a stop-loss should trigger.
 *
 * Breach state is persisted in Redis so it survives process restarts and works
 * correctly in multi-instance deployments behind a distributed lock.
 */
@Injectable()
export class StopLossWatcherService {
    /** Minimum time the price must stay below the SL price before triggering. */
    private static readonly CONFIRM_DURATION_MS = 30_000;
    /** Minimum penetration below SL price required to confirm a real breakout. */
    private static readonly PENETRATION_PCT = 0.002; // 0.2 %
    /** TTL for breach state keys — long enough for the 30s confirmation window plus buffer. */
    private static readonly BREACH_TTL_SECONDS = 300; // 5 minutes

    constructor(@Inject(CACHE_PORT) private readonly cache: CachePort) {}

    async evaluate(input: StopLossEvaluateInput): Promise<StopLossWatchDecision> {
        const { gridId, stopLossEnabled, stopLossPrice, currentPrice, now } = input;

        if (!stopLossEnabled || stopLossPrice === null) {
            return StopLossWatchDecision.NoBreach;
        }

        // Price is above (or equal to) the SL price — clear breach state.
        if (currentPrice > stopLossPrice) {
            await this.deleteBreachState(gridId);
            return StopLossWatchDecision.NoBreach;
        }

        // Price is below SL price — check penetration threshold.
        const penetrationThreshold = stopLossPrice * (1 - StopLossWatcherService.PENETRATION_PCT);
        if (currentPrice > penetrationThreshold) {
            // Below stop price but not enough penetration — treat as noise.
            return StopLossWatchDecision.NoBreach;
        }

        // Sufficient penetration. Record first breach time if not already recorded.
        const existing = await this.getBreachState(gridId);
        if (!existing) {
            await this.setBreachState(gridId, new StopLossBreachState(now));
        }

        const state = existing ?? new StopLossBreachState(now);
        const elapsed = now - state.firstBreachAt;

        if (elapsed < StopLossWatcherService.CONFIRM_DURATION_MS) {
            return StopLossWatchDecision.BreachUnconfirmed;
        }

        // Both conditions met — trigger. Clear state so it won't fire again.
        await this.deleteBreachState(gridId);
        return StopLossWatchDecision.Trigger;
    }

    /** Explicitly clear breach state for a grid (e.g. after it is stopped). */
    async clear(gridId: string): Promise<void> {
        await this.deleteBreachState(gridId);
    }

    private breachKey(gridId: string): string {
        return `sl:breach:${gridId}`;
    }

    private async getBreachState(gridId: string): Promise<StopLossBreachState | null> {
        const raw = await this.cache.get(this.breachKey(gridId));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { firstBreachAt: number };
        return new StopLossBreachState(parsed.firstBreachAt);
    }

    private async setBreachState(gridId: string, state: StopLossBreachState): Promise<void> {
        await this.cache.set(
            this.breachKey(gridId),
            JSON.stringify({ firstBreachAt: state.firstBreachAt }),
            StopLossWatcherService.BREACH_TTL_SECONDS,
        );
    }

    private async deleteBreachState(gridId: string): Promise<void> {
        await this.cache.del(this.breachKey(gridId));
    }
}
