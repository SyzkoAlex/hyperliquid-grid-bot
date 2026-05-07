import { Injectable } from '@nestjs/common';
import { StopLossWatchDecision } from './types/stop-loss-watch-decision';
import { StopLossBreachState } from './types/stop-loss-breach-state';
import { StopLossEvaluateInput } from './types/stop-loss-evaluate-input';

/**
 * Pure domain service that decides whether a stop-loss should trigger.
 *
 * Maintains in-memory breach state per gridId. Lifetime equals the process;
 * on restart the breach reaccumulates from zero — worst case is a small extra
 * delay, never a missed exit.
 */
@Injectable()
export class StopLossWatcherService {
    /** Minimum time the price must stay below the SL price before triggering. */
    private static readonly CONFIRM_DURATION_MS = 30_000;
    /** Minimum penetration below SL price required to confirm a real breakout. */
    private static readonly PENETRATION_PCT = 0.002; // 0.2 %

    private readonly breachStates = new Map<string, StopLossBreachState>();

    evaluate(input: StopLossEvaluateInput): StopLossWatchDecision {
        const { gridId, stopLossEnabled, stopLossPrice, currentPrice, now } = input;

        if (!stopLossEnabled || stopLossPrice === null) {
            return StopLossWatchDecision.NoBreach;
        }

        // Price is above (or equal to) the SL price — clear breach state.
        if (currentPrice > stopLossPrice) {
            this.breachStates.delete(gridId);
            return StopLossWatchDecision.NoBreach;
        }

        // Price is below SL price — check penetration threshold.
        const penetrationThreshold = stopLossPrice * (1 - StopLossWatcherService.PENETRATION_PCT);
        if (currentPrice > penetrationThreshold) {
            // Below stop price but not enough penetration — treat as noise.
            return StopLossWatchDecision.NoBreach;
        }

        // Sufficient penetration. Record first breach time if not already recorded.
        if (!this.breachStates.has(gridId)) {
            this.breachStates.set(gridId, new StopLossBreachState(now));
        }

        const state = this.breachStates.get(gridId)!;
        const elapsed = now - state.firstBreachAt;

        if (elapsed < StopLossWatcherService.CONFIRM_DURATION_MS) {
            return StopLossWatchDecision.BreachUnconfirmed;
        }

        // Both conditions met — trigger. Clear state so it won't fire again.
        this.breachStates.delete(gridId);
        return StopLossWatchDecision.Trigger;
    }

    /** Explicitly clear breach state for a grid (e.g. after it is stopped). */
    clear(gridId: string): void {
        this.breachStates.delete(gridId);
    }
}
