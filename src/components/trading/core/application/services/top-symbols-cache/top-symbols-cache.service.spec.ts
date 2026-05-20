import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TopSymbolsCacheService } from './top-symbols-cache.service';
import { TokenDescriptor } from '@components/trading/core/domain/models/token/token-descriptor';
import { CachePort } from '@/core/application/ports/outbound/cache.port';

describe('TopSymbolsCacheService', () => {
    let sut: TopSymbolsCacheService;
    let mockCache: {
        get: ReturnType<typeof vi.fn>;
        set: ReturnType<typeof vi.fn>;
        del: ReturnType<typeof vi.fn>;
    };

    const CACHE_KEY = 'trading:top-symbols:v2';
    const TTL = 86400;
    const TOKENS: TokenDescriptor[] = [
        { symbol: 'HYPE', displayName: 'HYPE' },
        { symbol: 'UBTC', displayName: 'BTC' },
        { symbol: 'USOL', displayName: 'SOL' },
    ];

    beforeEach(() => {
        mockCache = {
            get: vi.fn().mockResolvedValue(null),
            set: vi.fn().mockResolvedValue(undefined),
            del: vi.fn().mockResolvedValue(undefined),
        };
        sut = new TopSymbolsCacheService(mockCache as unknown as CachePort);
    });

    describe('get', () => {
        it('returns null when no entry in cache', async () => {
            const result = await sut.get();
            expect(result).toBeNull();
        });

        it('returns parsed TokenDescriptor array on valid JSON', async () => {
            mockCache.get.mockResolvedValue(JSON.stringify(TOKENS));
            const result = await sut.get();
            expect(result).toEqual(TOKENS);
        });

        it('returns null and clears key on corrupted JSON', async () => {
            mockCache.get.mockResolvedValue('not-valid-json{{{');
            const result = await sut.get();
            expect(result).toBeNull();
            expect(mockCache.del).toHaveBeenCalledWith(CACHE_KEY);
        });

        it('returns null and clears key when value is not an array', async () => {
            mockCache.get.mockResolvedValue(
                JSON.stringify({ symbol: 'HYPE', displayName: 'HYPE' }),
            );
            const result = await sut.get();
            expect(result).toBeNull();
            expect(mockCache.del).toHaveBeenCalledWith(CACHE_KEY);
        });

        it('returns null and clears key when items are plain strings', async () => {
            mockCache.get.mockResolvedValue(JSON.stringify(['HYPE', 'BTC']));
            const result = await sut.get();
            expect(result).toBeNull();
            expect(mockCache.del).toHaveBeenCalledWith(CACHE_KEY);
        });

        it('returns null and clears key when item is missing displayName', async () => {
            mockCache.get.mockResolvedValue(JSON.stringify([{ symbol: 'HYPE' }]));
            const result = await sut.get();
            expect(result).toBeNull();
            expect(mockCache.del).toHaveBeenCalledWith(CACHE_KEY);
        });

        it('returns null and clears key when item is missing symbol', async () => {
            mockCache.get.mockResolvedValue(JSON.stringify([{ displayName: 'HYPE' }]));
            const result = await sut.get();
            expect(result).toBeNull();
            expect(mockCache.del).toHaveBeenCalledWith(CACHE_KEY);
        });
    });

    describe('set', () => {
        it('writes JSON-encoded TokenDescriptor array with the given TTL and correct key', async () => {
            await sut.set(TOKENS, TTL);
            expect(mockCache.set).toHaveBeenCalledWith(CACHE_KEY, JSON.stringify(TOKENS), TTL);
        });
    });

    describe('getOrDefault', () => {
        const DEFAULTS: ReadonlyArray<TokenDescriptor> = [
            { symbol: 'HYPE', displayName: 'HYPE' },
            { symbol: 'UBTC', displayName: 'BTC' },
            { symbol: 'UETH', displayName: 'ETH' },
        ];

        it('returns cached tokens sliced to limit when cache is non-empty', async () => {
            mockCache.get.mockResolvedValue(JSON.stringify(TOKENS));

            const result = await sut.getOrDefault(2, DEFAULTS);

            expect(result).toEqual(TOKENS.slice(0, 2));
        });

        it('returns defaults sliced to limit when cache is empty (null)', async () => {
            mockCache.get.mockResolvedValue(null);

            const result = await sut.getOrDefault(2, DEFAULTS);

            expect(result).toEqual([...DEFAULTS].slice(0, 2));
        });

        it('returns defaults sliced to limit when cache has an empty array', async () => {
            mockCache.get.mockResolvedValue(JSON.stringify([]));

            const result = await sut.getOrDefault(2, DEFAULTS);

            expect(result).toEqual([...DEFAULTS].slice(0, 2));
        });

        it('returns all cached tokens when limit exceeds cache size', async () => {
            mockCache.get.mockResolvedValue(JSON.stringify(TOKENS));

            const result = await sut.getOrDefault(10, DEFAULTS);

            expect(result).toEqual(TOKENS);
        });
    });
});
