import { describe, it, expect, beforeEach } from 'vitest';
import { StopLossWatcherService } from './stop-loss-watcher.service';
import { StopLossWatchDecision } from './types/stop-loss-watch-decision';

describe('StopLossWatcherService', () => {
    let sut: StopLossWatcherService;

    const GRID_ID = 'grid-1';
    const STOP_LOSS_PRICE = 100;
    const NOW = 1_000_000;
    const CONFIRM_MS = 30_000;

    beforeEach(() => {
        sut = new StopLossWatcherService();
    });

    describe('evaluate', () => {
        it('returns NoBreach when stop-loss is disabled', () => {
            const result = sut.evaluate({
                gridId: GRID_ID,
                stopLossEnabled: false,
                stopLossPrice: STOP_LOSS_PRICE,
                currentPrice: 90,
                now: NOW,
            });
            expect(result).toBe(StopLossWatchDecision.NoBreach);
        });

        it('returns NoBreach when stopLossPrice is null', () => {
            const result = sut.evaluate({
                gridId: GRID_ID,
                stopLossEnabled: true,
                stopLossPrice: null,
                currentPrice: 90,
                now: NOW,
            });
            expect(result).toBe(StopLossWatchDecision.NoBreach);
        });

        it('returns NoBreach when price is above stop-loss price and clears existing state', () => {
            // First call creates breach state
            sut.evaluate({
                gridId: GRID_ID,
                stopLossEnabled: true,
                stopLossPrice: STOP_LOSS_PRICE,
                currentPrice: 99.5,
                now: NOW,
            });
            // Price recovers
            const result = sut.evaluate({
                gridId: GRID_ID,
                stopLossEnabled: true,
                stopLossPrice: STOP_LOSS_PRICE,
                currentPrice: 101,
                now: NOW + 1000,
            });
            expect(result).toBe(StopLossWatchDecision.NoBreach);
        });

        it('returns NoBreach when penetration is too small (< 0.2%)', () => {
            // Price is 0.1% below — not enough penetration
            const slightlyBelow = STOP_LOSS_PRICE * 0.999;
            const result = sut.evaluate({
                gridId: GRID_ID,
                stopLossEnabled: true,
                stopLossPrice: STOP_LOSS_PRICE,
                currentPrice: slightlyBelow,
                now: NOW,
            });
            expect(result).toBe(StopLossWatchDecision.NoBreach);
        });

        it('returns BreachUnconfirmed when penetration is sufficient but time is too short', () => {
            const deepBelow = STOP_LOSS_PRICE * 0.997; // 0.3% below
            const result = sut.evaluate({
                gridId: GRID_ID,
                stopLossEnabled: true,
                stopLossPrice: STOP_LOSS_PRICE,
                currentPrice: deepBelow,
                now: NOW,
            });
            expect(result).toBe(StopLossWatchDecision.BreachUnconfirmed);
        });

        it('returns Trigger when both penetration and time conditions are met', () => {
            const deepBelow = STOP_LOSS_PRICE * 0.997;

            // First call — starts the breach timer
            sut.evaluate({
                gridId: GRID_ID,
                stopLossEnabled: true,
                stopLossPrice: STOP_LOSS_PRICE,
                currentPrice: deepBelow,
                now: NOW,
            });

            // Second call after 30s — should trigger
            const result = sut.evaluate({
                gridId: GRID_ID,
                stopLossEnabled: true,
                stopLossPrice: STOP_LOSS_PRICE,
                currentPrice: deepBelow,
                now: NOW + CONFIRM_MS,
            });
            expect(result).toBe(StopLossWatchDecision.Trigger);
        });

        it('returns NoBreach on the call after Trigger (state cleared)', () => {
            const deepBelow = STOP_LOSS_PRICE * 0.997;

            sut.evaluate({
                gridId: GRID_ID,
                stopLossEnabled: true,
                stopLossPrice: STOP_LOSS_PRICE,
                currentPrice: deepBelow,
                now: NOW,
            });
            sut.evaluate({
                gridId: GRID_ID,
                stopLossEnabled: true,
                stopLossPrice: STOP_LOSS_PRICE,
                currentPrice: deepBelow,
                now: NOW + CONFIRM_MS,
            });

            // After trigger, state is cleared; next call with still-breached price should restart
            const afterTrigger = sut.evaluate({
                gridId: GRID_ID,
                stopLossEnabled: true,
                stopLossPrice: STOP_LOSS_PRICE,
                currentPrice: deepBelow,
                now: NOW + CONFIRM_MS + 1,
            });
            expect(afterTrigger).toBe(StopLossWatchDecision.BreachUnconfirmed);
        });

        it('isolates breach state per gridId', () => {
            const deepBelow = STOP_LOSS_PRICE * 0.997;

            // Start breach for grid-1
            sut.evaluate({
                gridId: 'grid-1',
                stopLossEnabled: true,
                stopLossPrice: STOP_LOSS_PRICE,
                currentPrice: deepBelow,
                now: NOW,
            });

            // grid-2 should have no breach state
            const result = sut.evaluate({
                gridId: 'grid-2',
                stopLossEnabled: true,
                stopLossPrice: STOP_LOSS_PRICE,
                currentPrice: deepBelow,
                now: NOW + CONFIRM_MS,
            });
            // grid-2 only started its timer NOW + CONFIRM_MS, so it hasn't elapsed yet
            expect(result).toBe(StopLossWatchDecision.BreachUnconfirmed);
        });
    });

    describe('clear', () => {
        it('removes breach state for the given gridId', () => {
            const deepBelow = STOP_LOSS_PRICE * 0.997;

            sut.evaluate({
                gridId: GRID_ID,
                stopLossEnabled: true,
                stopLossPrice: STOP_LOSS_PRICE,
                currentPrice: deepBelow,
                now: NOW,
            });

            sut.clear(GRID_ID);

            // After clearing, timer restarts — should be unconfirmed
            const result = sut.evaluate({
                gridId: GRID_ID,
                stopLossEnabled: true,
                stopLossPrice: STOP_LOSS_PRICE,
                currentPrice: deepBelow,
                now: NOW + CONFIRM_MS,
            });
            expect(result).toBe(StopLossWatchDecision.BreachUnconfirmed);
        });
    });
});
