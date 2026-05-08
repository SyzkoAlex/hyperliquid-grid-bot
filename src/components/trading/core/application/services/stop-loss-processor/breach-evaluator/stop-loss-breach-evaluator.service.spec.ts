import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StopLossBreachEvaluatorService } from './stop-loss-breach-evaluator.service';
import { StopLossBreachState } from '../types/stop-loss-breach-state';

const CONFIRM_MS = 30_000;
const PENETRATION_PCT = 0.002;
const BREACH_TTL_SECONDS = 300;
const STOP_LOSS_PRICE = 100;
const NOW = 1_000_000;
const GRID_ID = 'grid-1';

function makeConfig() {
    return {
        get: vi.fn((key: string) => {
            if (key === 'stopLoss') {
                return {
                    confirmDurationMs: CONFIRM_MS,
                    penetrationPct: PENETRATION_PCT,
                    breachTtlSeconds: BREACH_TTL_SECONDS,
                    initialSlippageCapPct: 0.01,
                    retrySlippageCapPct: 0.02,
                };
            }
        }),
    };
}

describe('StopLossBreachEvaluatorService', () => {
    let sut: StopLossBreachEvaluatorService;
    let mockBreachCache: {
        get: ReturnType<typeof vi.fn>;
        set: ReturnType<typeof vi.fn>;
        delete: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        mockBreachCache = {
            get: vi.fn().mockResolvedValue(null),
            set: vi.fn().mockResolvedValue(undefined),
            delete: vi.fn().mockResolvedValue(undefined),
        };
        sut = new StopLossBreachEvaluatorService(mockBreachCache as any, makeConfig() as any);
    });

    it('clears breach state and returns false when price is above stop-loss', async () => {
        const result = await sut.evaluate(GRID_ID, STOP_LOSS_PRICE, STOP_LOSS_PRICE + 1, NOW);
        expect(result).toBe(false);
        expect(mockBreachCache.delete).toHaveBeenCalledWith(GRID_ID);
    });

    it('returns false and does not record breach when penetration is too small (< 0.2%)', async () => {
        const slightlyBelow = STOP_LOSS_PRICE * 0.999;
        const result = await sut.evaluate(GRID_ID, STOP_LOSS_PRICE, slightlyBelow, NOW);
        expect(result).toBe(false);
        expect(mockBreachCache.set).not.toHaveBeenCalled();
    });

    it('records breach state and returns false when penetration is sufficient but time is too short', async () => {
        const deepBelow = STOP_LOSS_PRICE * 0.997;
        const result = await sut.evaluate(GRID_ID, STOP_LOSS_PRICE, deepBelow, NOW);
        expect(result).toBe(false);
        expect(mockBreachCache.set).toHaveBeenCalledWith(
            GRID_ID,
            new StopLossBreachState(NOW),
            BREACH_TTL_SECONDS,
        );
    });

    it('does not overwrite existing breach state on subsequent calls', async () => {
        const deepBelow = STOP_LOSS_PRICE * 0.997;
        mockBreachCache.get.mockResolvedValue(new StopLossBreachState(NOW - 5000));
        await sut.evaluate(GRID_ID, STOP_LOSS_PRICE, deepBelow, NOW);
        expect(mockBreachCache.set).not.toHaveBeenCalled();
    });

    it('returns true and clears state when both penetration and duration are met', async () => {
        const deepBelow = STOP_LOSS_PRICE * 0.997;
        mockBreachCache.get.mockResolvedValue(new StopLossBreachState(NOW - CONFIRM_MS));
        const result = await sut.evaluate(GRID_ID, STOP_LOSS_PRICE, deepBelow, NOW);
        expect(result).toBe(true);
        expect(mockBreachCache.delete).toHaveBeenCalledWith(GRID_ID);
    });

    it('isolates breach state per gridId', async () => {
        const deepBelow = STOP_LOSS_PRICE * 0.997;
        mockBreachCache.get.mockImplementation(async (id: string) =>
            id === 'grid-1' ? new StopLossBreachState(NOW - CONFIRM_MS) : null,
        );

        expect(await sut.evaluate('grid-1', STOP_LOSS_PRICE, deepBelow, NOW)).toBe(true);
        expect(await sut.evaluate('grid-2', STOP_LOSS_PRICE, deepBelow, NOW)).toBe(false);
    });
});
