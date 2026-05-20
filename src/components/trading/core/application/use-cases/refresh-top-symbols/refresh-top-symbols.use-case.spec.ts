import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RefreshTopSymbolsUseCase } from './refresh-top-symbols.use-case';
import { ExchangePort } from '@components/trading/core/application/ports/exchange.port';
import { TopSymbolsCacheService } from '@components/trading/core/application/services/top-symbols-cache/top-symbols-cache.service';

const TOKENS = [
    { symbol: 'HYPE', displayName: 'HYPE' },
    { symbol: 'UBTC', displayName: 'BTC' },
];

describe('RefreshTopSymbolsUseCase', () => {
    let sut: RefreshTopSymbolsUseCase;
    let mockExchange: { getTopSymbolsByVolume: ReturnType<typeof vi.fn> };
    let mockCache: {
        set: ReturnType<typeof vi.fn>;
        get: ReturnType<typeof vi.fn>;
        getOrDefault: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        mockExchange = {
            getTopSymbolsByVolume: vi.fn().mockResolvedValue(TOKENS),
        };
        mockCache = {
            set: vi.fn().mockResolvedValue(undefined),
            get: vi.fn(),
            getOrDefault: vi.fn(),
        };
        sut = new RefreshTopSymbolsUseCase(
            mockExchange as unknown as ExchangePort,
            mockCache as unknown as TopSymbolsCacheService,
        );
    });

    describe('execute', () => {
        it('fetches from exchange and writes to cache when tokens are returned', async () => {
            await sut.execute(10, 86400);

            expect(mockExchange.getTopSymbolsByVolume).toHaveBeenCalledWith(10);
            expect(mockCache.set).toHaveBeenCalledWith(TOKENS, 86400);
        });

        it('does not write to cache when exchange returns empty array', async () => {
            mockExchange.getTopSymbolsByVolume.mockResolvedValue([]);

            await sut.execute(10, 86400);

            expect(mockCache.set).not.toHaveBeenCalled();
        });
    });
});
