import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetTopSymbolsUseCase } from './get-top-symbols.use-case';
import { TopSymbolsCacheService } from '@components/trading/core/application/services/top-symbols-cache/top-symbols-cache.service';
import { TokenDescriptor } from '@components/trading/core/domain/models/token/token-descriptor';

const CACHED_TOKENS: TokenDescriptor[] = [
    { symbol: 'HYPE', displayName: 'HYPE' },
    { symbol: 'UBTC', displayName: 'BTC' },
];

const DEFAULT_FALLBACK: TokenDescriptor[] = [{ symbol: 'BTC', displayName: 'BTC' }];

describe('GetTopSymbolsUseCase', () => {
    let sut: GetTopSymbolsUseCase;
    let mockCache: { getOrDefault: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        mockCache = {
            getOrDefault: vi.fn().mockResolvedValue(CACHED_TOKENS),
        };
        sut = new GetTopSymbolsUseCase(mockCache as unknown as TopSymbolsCacheService);
    });

    describe('execute', () => {
        it('delegates to cache.getOrDefault with the given limit and DEFAULT_TOP_TOKENS', async () => {
            const result = await sut.execute(5);

            expect(mockCache.getOrDefault).toHaveBeenCalledWith(5, expect.any(Array));
            expect(result).toBe(CACHED_TOKENS);
        });

        it('returns the fallback list when cache returns defaults', async () => {
            mockCache.getOrDefault.mockResolvedValue(DEFAULT_FALLBACK);

            const result = await sut.execute(5);

            expect(result).toBe(DEFAULT_FALLBACK);
        });
    });
});
