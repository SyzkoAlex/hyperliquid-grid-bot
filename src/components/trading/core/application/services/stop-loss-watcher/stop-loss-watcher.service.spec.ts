import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StopLossWatcherService } from './stop-loss-watcher.service';
import { StopLossWatchDecision } from './types/stop-loss-watch-decision';
import { StopLossBreachState } from './types/stop-loss-breach-state';

const CONFIRM_MS = 30_000;
const PENETRATION_PCT = 0.002;
const BREACH_TTL_SECONDS = 300;

function makeConfig() {
    return {
        get: vi.fn((key: string) => {
            if (key === 'stopLoss.confirmDurationMs') return CONFIRM_MS;
            if (key === 'stopLoss.penetrationPct') return PENETRATION_PCT;
            if (key === 'stopLoss.breachTtlSeconds') return BREACH_TTL_SECONDS;
        }),
    };
}

describe('StopLossWatcherService', () => {
    let sut: StopLossWatcherService;
    let mockBreachCache: {
        get: ReturnType<typeof vi.fn>;
        set: ReturnType<typeof vi.fn>;
        delete: ReturnType<typeof vi.fn>;
    };

    const GRID_ID = 'grid-1';
    const STOP_LOSS_PRICE = 100;
    const NOW = 1_000_000;

    beforeEach(() => {
        mockBreachCache = {
            get: vi.fn().mockResolvedValue(null),
            set: vi.fn().mockResolvedValue(undefined),
            delete: vi.fn().mockResolvedValue(undefined),
        };
        sut = new StopLossWatcherService(mockBreachCache as any, makeConfig() as any);
    });

    describe('evaluate', () => {
        it('returns NoBreach when stop-loss is disabled', async () => {
            const result = await sut.evaluate({
                gridId: GRID_ID,
                stopLossEnabled: false,
                stopLossPrice: STOP_LOSS_PRICE,
                currentPrice: 90,
                now: NOW,
            });
            expect(result).toBe(StopLossWatchDecision.NoBreach);
        });

        it('returns NoBreach when stopLossPrice is null', async () => {
            const result = await sut.evaluate({
                gridId: GRID_ID,
                stopLossEnabled: true,
                stopLossPrice: null,
                currentPrice: 90,
                now: NOW,
            });
            expect(result).toBe(StopLossWatchDecision.NoBreach);
        });

        it('returns NoBreach and clears state when price is above stop-loss price', async () => {
            const result = await sut.evaluate({
                gridId: GRID_ID,
                stopLossEnabled: true,
                stopLossPrice: STOP_LOSS_PRICE,
                currentPrice: 101,
                now: NOW,
            });
            expect(result).toBe(StopLossWatchDecision.NoBreach);
            expect(mockBreachCache.delete).toHaveBeenCalledWith(GRID_ID);
        });

        it('returns NoBreach when penetration is too small (< 0.2%)', async () => {
            const slightlyBelow = STOP_LOSS_PRICE * 0.999;
            const result = await sut.evaluate({
                gridId: GRID_ID,
                stopLossEnabled: true,
                stopLossPrice: STOP_LOSS_PRICE,
                currentPrice: slightlyBelow,
                now: NOW,
            });
            expect(result).toBe(StopLossWatchDecision.NoBreach);
            expect(mockBreachCache.set).not.toHaveBeenCalled();
        });

        it('returns BreachUnconfirmed and stores state when penetration is sufficient but time is too short', async () => {
            const deepBelow = STOP_LOSS_PRICE * 0.997;
            const result = await sut.evaluate({
                gridId: GRID_ID,
                stopLossEnabled: true,
                stopLossPrice: STOP_LOSS_PRICE,
                currentPrice: deepBelow,
                now: NOW,
            });
            expect(result).toBe(StopLossWatchDecision.BreachUnconfirmed);
            expect(mockBreachCache.set).toHaveBeenCalledWith(
                GRID_ID,
                new StopLossBreachState(NOW),
                BREACH_TTL_SECONDS,
            );
        });

        it('returns Trigger when both penetration and time conditions are met', async () => {
            const deepBelow = STOP_LOSS_PRICE * 0.997;
            mockBreachCache.get.mockResolvedValue(new StopLossBreachState(NOW - CONFIRM_MS));

            const result = await sut.evaluate({
                gridId: GRID_ID,
                stopLossEnabled: true,
                stopLossPrice: STOP_LOSS_PRICE,
                currentPrice: deepBelow,
                now: NOW,
            });
            expect(result).toBe(StopLossWatchDecision.Trigger);
            expect(mockBreachCache.delete).toHaveBeenCalledWith(GRID_ID);
        });

        it('does not overwrite existing breach state on subsequent calls', async () => {
            const deepBelow = STOP_LOSS_PRICE * 0.997;
            mockBreachCache.get.mockResolvedValue(new StopLossBreachState(NOW - 5000));

            const result = await sut.evaluate({
                gridId: GRID_ID,
                stopLossEnabled: true,
                stopLossPrice: STOP_LOSS_PRICE,
                currentPrice: deepBelow,
                now: NOW,
            });

            expect(mockBreachCache.set).not.toHaveBeenCalled();
            expect(result).toBe(StopLossWatchDecision.BreachUnconfirmed);
        });

        it('returns NoBreach on the call after Trigger (state cleared)', async () => {
            const deepBelow = STOP_LOSS_PRICE * 0.997;

            mockBreachCache.get.mockResolvedValueOnce(new StopLossBreachState(NOW - CONFIRM_MS));
            await sut.evaluate({
                gridId: GRID_ID,
                stopLossEnabled: true,
                stopLossPrice: STOP_LOSS_PRICE,
                currentPrice: deepBelow,
                now: NOW,
            });

            mockBreachCache.get.mockResolvedValueOnce(null);
            const afterTrigger = await sut.evaluate({
                gridId: GRID_ID,
                stopLossEnabled: true,
                stopLossPrice: STOP_LOSS_PRICE,
                currentPrice: deepBelow,
                now: NOW + 1,
            });
            expect(afterTrigger).toBe(StopLossWatchDecision.BreachUnconfirmed);
        });

        it('isolates breach state per gridId', async () => {
            const deepBelow = STOP_LOSS_PRICE * 0.997;

            mockBreachCache.get.mockImplementation(async (gridId: string) => {
                if (gridId === 'grid-1') return new StopLossBreachState(NOW - CONFIRM_MS);
                return null;
            });

            const result1 = await sut.evaluate({
                gridId: 'grid-1',
                stopLossEnabled: true,
                stopLossPrice: STOP_LOSS_PRICE,
                currentPrice: deepBelow,
                now: NOW,
            });
            expect(result1).toBe(StopLossWatchDecision.Trigger);

            const result2 = await sut.evaluate({
                gridId: 'grid-2',
                stopLossEnabled: true,
                stopLossPrice: STOP_LOSS_PRICE,
                currentPrice: deepBelow,
                now: NOW,
            });
            expect(result2).toBe(StopLossWatchDecision.BreachUnconfirmed);
        });
    });

    describe('clear', () => {
        it('deletes breach state for the given gridId', async () => {
            await sut.clear(GRID_ID);
            expect(mockBreachCache.delete).toHaveBeenCalledWith(GRID_ID);
        });
    });
});
