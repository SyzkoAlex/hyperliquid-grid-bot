import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StopLossBreachStateCacheService } from './stop-loss-breach-state-cache.service';
import { StopLossBreachState } from '../types/stop-loss-breach-state';

describe('StopLossBreachStateCacheService', () => {
    let sut: StopLossBreachStateCacheService;
    let mockCache: {
        get: ReturnType<typeof vi.fn>;
        set: ReturnType<typeof vi.fn>;
        del: ReturnType<typeof vi.fn>;
    };

    const GRID_ID = 'grid-1';
    const KEY = `sl:breach:${GRID_ID}`;
    const TTL = 300;
    const FIRST_BREACH_AT = 1_000_000;

    beforeEach(() => {
        mockCache = {
            get: vi.fn().mockResolvedValue(null),
            set: vi.fn().mockResolvedValue(undefined),
            del: vi.fn().mockResolvedValue(undefined),
        };
        sut = new StopLossBreachStateCacheService(mockCache as any);
    });

    describe('get', () => {
        it('returns null when no entry in cache', async () => {
            const result = await sut.get(GRID_ID);
            expect(result).toBeNull();
        });

        it('returns StopLossBreachState with correct firstBreachAt', async () => {
            mockCache.get.mockResolvedValue(JSON.stringify({ firstBreachAt: FIRST_BREACH_AT }));
            const result = await sut.get(GRID_ID);
            expect(result).toBeInstanceOf(StopLossBreachState);
            expect(result?.firstBreachAt).toBe(FIRST_BREACH_AT);
        });

        it('returns null and clears key on corrupted JSON', async () => {
            mockCache.get.mockResolvedValue('not-valid-json{{{');
            const result = await sut.get(GRID_ID);
            expect(result).toBeNull();
            expect(mockCache.del).toHaveBeenCalledWith(KEY);
        });

        it('returns null and clears key when firstBreachAt is missing', async () => {
            mockCache.get.mockResolvedValue(JSON.stringify({ someOtherField: 123 }));
            const result = await sut.get(GRID_ID);
            expect(result).toBeNull();
            expect(mockCache.del).toHaveBeenCalledWith(KEY);
        });

        it('returns null and clears key when firstBreachAt is not a number', async () => {
            mockCache.get.mockResolvedValue(JSON.stringify({ firstBreachAt: 'oops' }));
            const result = await sut.get(GRID_ID);
            expect(result).toBeNull();
            expect(mockCache.del).toHaveBeenCalledWith(KEY);
        });
    });

    describe('set', () => {
        it('serialises state and stores it with the given TTL', async () => {
            const state = new StopLossBreachState(FIRST_BREACH_AT);
            await sut.set(GRID_ID, state, TTL);
            expect(mockCache.set).toHaveBeenCalledWith(
                KEY,
                JSON.stringify({ firstBreachAt: FIRST_BREACH_AT }),
                TTL,
            );
        });
    });

    describe('delete', () => {
        it('removes the key from cache', async () => {
            await sut.delete(GRID_ID);
            expect(mockCache.del).toHaveBeenCalledWith(KEY);
        });
    });
});
