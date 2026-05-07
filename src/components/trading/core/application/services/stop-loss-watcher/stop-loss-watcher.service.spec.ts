import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StopLossWatcherService } from './stop-loss-watcher.service';
import { StopLossWatchDecision } from './types/stop-loss-watch-decision';

describe('StopLossWatcherService', () => {
    let sut: StopLossWatcherService;
    let mockCache: {
        get: ReturnType<typeof vi.fn>;
        set: ReturnType<typeof vi.fn>;
        del: ReturnType<typeof vi.fn>;
    };

    const GRID_ID = 'grid-1';
    const STOP_LOSS_PRICE = 100;
    const NOW = 1_000_000;
    const CONFIRM_MS = 30_000;

    beforeEach(() => {
        mockCache = {
            get: vi.fn().mockResolvedValue(null),
            set: vi.fn().mockResolvedValue(undefined),
            del: vi.fn().mockResolvedValue(undefined),
        };
        sut = new StopLossWatcherService(mockCache as any);
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
            expect(mockCache.del).toHaveBeenCalledWith(`sl:breach:${GRID_ID}`);
        });

        it('returns NoBreach when penetration is too small (< 0.2%)', async () => {
            // Price is 0.1% below — not enough penetration
            const slightlyBelow = STOP_LOSS_PRICE * 0.999;
            const result = await sut.evaluate({
                gridId: GRID_ID,
                stopLossEnabled: true,
                stopLossPrice: STOP_LOSS_PRICE,
                currentPrice: slightlyBelow,
                now: NOW,
            });
            expect(result).toBe(StopLossWatchDecision.NoBreach);
            expect(mockCache.set).not.toHaveBeenCalled();
        });

        it('returns BreachUnconfirmed and stores state when penetration is sufficient but time is too short', async () => {
            const deepBelow = STOP_LOSS_PRICE * 0.997; // 0.3% below
            const result = await sut.evaluate({
                gridId: GRID_ID,
                stopLossEnabled: true,
                stopLossPrice: STOP_LOSS_PRICE,
                currentPrice: deepBelow,
                now: NOW,
            });
            expect(result).toBe(StopLossWatchDecision.BreachUnconfirmed);
            expect(mockCache.set).toHaveBeenCalledWith(
                `sl:breach:${GRID_ID}`,
                JSON.stringify({ firstBreachAt: NOW }),
                300,
            );
        });

        it('returns Trigger when both penetration and time conditions are met', async () => {
            const deepBelow = STOP_LOSS_PRICE * 0.997;

            // Simulate existing breach state from 30s ago
            mockCache.get.mockResolvedValue(JSON.stringify({ firstBreachAt: NOW - CONFIRM_MS }));

            const result = await sut.evaluate({
                gridId: GRID_ID,
                stopLossEnabled: true,
                stopLossPrice: STOP_LOSS_PRICE,
                currentPrice: deepBelow,
                now: NOW,
            });
            expect(result).toBe(StopLossWatchDecision.Trigger);
            expect(mockCache.del).toHaveBeenCalledWith(`sl:breach:${GRID_ID}`);
        });

        it('does not overwrite existing breach state on subsequent calls', async () => {
            const deepBelow = STOP_LOSS_PRICE * 0.997;

            // Existing state already in Redis
            mockCache.get.mockResolvedValue(JSON.stringify({ firstBreachAt: NOW - 5000 }));

            const result = await sut.evaluate({
                gridId: GRID_ID,
                stopLossEnabled: true,
                stopLossPrice: STOP_LOSS_PRICE,
                currentPrice: deepBelow,
                now: NOW,
            });

            // Should not re-set — state already exists
            expect(mockCache.set).not.toHaveBeenCalled();
            expect(result).toBe(StopLossWatchDecision.BreachUnconfirmed);
        });

        it('returns NoBreach on the call after Trigger (state cleared)', async () => {
            const deepBelow = STOP_LOSS_PRICE * 0.997;

            // First call: Trigger fires, state is cleared
            mockCache.get.mockResolvedValueOnce(
                JSON.stringify({ firstBreachAt: NOW - CONFIRM_MS }),
            );

            await sut.evaluate({
                gridId: GRID_ID,
                stopLossEnabled: true,
                stopLossPrice: STOP_LOSS_PRICE,
                currentPrice: deepBelow,
                now: NOW,
            });

            // Second call: no existing state in Redis (was deleted)
            mockCache.get.mockResolvedValueOnce(null);

            const afterTrigger = await sut.evaluate({
                gridId: GRID_ID,
                stopLossEnabled: true,
                stopLossPrice: STOP_LOSS_PRICE,
                currentPrice: deepBelow,
                now: NOW + 1,
            });
            // Timer restarts — should be unconfirmed
            expect(afterTrigger).toBe(StopLossWatchDecision.BreachUnconfirmed);
        });

        it('isolates breach state per gridId', async () => {
            const deepBelow = STOP_LOSS_PRICE * 0.997;

            // grid-1 has been in breach for 30s, grid-2 has no state
            mockCache.get.mockImplementation(async (key: string) => {
                if (key === 'sl:breach:grid-1') {
                    return JSON.stringify({ firstBreachAt: NOW - CONFIRM_MS });
                }
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
            // grid-2 only started its timer now, hasn't elapsed yet
            expect(result2).toBe(StopLossWatchDecision.BreachUnconfirmed);
        });
    });

    describe('clear', () => {
        it('deletes breach state for the given gridId', async () => {
            await sut.clear(GRID_ID);
            expect(mockCache.del).toHaveBeenCalledWith(`sl:breach:${GRID_ID}`);
        });
    });
});
