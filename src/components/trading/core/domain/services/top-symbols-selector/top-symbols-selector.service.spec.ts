import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TopSymbolsSelectorService } from './top-symbols-selector.service';
import { EXCLUDED_STABLECOIN_BASES } from '@components/trading/core/domain/models/constants/excluded-stablecoin-bases';
import { TokenDisplayResolverService } from '@components/trading/core/domain/services/token-display-resolver/token-display-resolver.service';
import { SpotMeta } from '@/infra/hyperliquid/types/hyperliquid-spot-meta';
import { HyperliquidSpotAssetCtx } from '@/infra/hyperliquid/types/hyperliquid-spot-asset-ctx';

function makeToken(
    name: string,
    index: number,
    fullName: string | null = null,
): SpotMeta['tokens'][number] {
    return { name, index, szDecimals: 2, fullName, isCanonical: true };
}

function makeCtx(dayNtlVlm: string): HyperliquidSpotAssetCtx {
    return { coin: '', dayNtlVlm, prevDayPx: '0', markPx: '0', midPx: null };
}

const BASE_META: SpotMeta = {
    tokens: [
        makeToken('USDC', 0),
        makeToken('HYPE', 1, 'Hyperliquid'),
        makeToken('UBTC', 2, 'Unit Bitcoin'),
        makeToken('USOL', 3, 'Unit Solana'),
        makeToken('USDT', 4),
        makeToken('USDH', 5, 'USDH'),
    ],
    universe: [
        { name: 'HYPE/USDC', tokens: [1, 0], index: 0, isCanonical: true },
        { name: 'UBTC/USDC', tokens: [2, 0], index: 1, isCanonical: true },
        { name: 'USOL/USDC', tokens: [3, 0], index: 2, isCanonical: true },
        { name: 'USDT/USDC', tokens: [4, 0], index: 3, isCanonical: true },
        { name: 'USDH/USDC', tokens: [5, 0], index: 4, isCanonical: true },
    ],
};

describe('TopSymbolsSelectorService', () => {
    let sut: TopSymbolsSelectorService;
    let mockResolver: { resolve: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        mockResolver = { resolve: vi.fn((t: { name: string }) => t.name) };
        sut = new TopSymbolsSelectorService(mockResolver as unknown as TokenDisplayResolverService);
    });

    describe('select', () => {
        it('sorts by dayNtlVlm descending and slices to limit', () => {
            const assetCtxs = [
                makeCtx('500'),
                makeCtx('1000'),
                makeCtx('300'),
                makeCtx('0'),
                makeCtx('0'),
            ];

            const result = sut.select(BASE_META, assetCtxs, 2);

            expect(result).toHaveLength(2);
            expect(result[0].symbol).toBe('UBTC');
            expect(result[1].symbol).toBe('HYPE');
        });

        it('excludes stablecoin bases (USDT, USDH)', () => {
            const assetCtxs = [
                makeCtx('100'),
                makeCtx('100'),
                makeCtx('100'),
                makeCtx('9999'),
                makeCtx('9999'),
            ];

            const result = sut.select(BASE_META, assetCtxs, 10);
            const symbols = result.map((t) => t.symbol);

            expect(symbols).not.toContain('USDT');
            expect(symbols).not.toContain('USDH');
        });

        it('returns [] when USDC token is missing from meta', () => {
            const metaWithoutUsdc: SpotMeta = {
                tokens: [makeToken('HYPE', 1)],
                universe: [{ name: 'HYPE/?', tokens: [1, 99], index: 0, isCanonical: true }],
            };
            const assetCtxs = [makeCtx('1000')];

            const result = sut.select(metaWithoutUsdc, assetCtxs, 10);

            expect(result).toEqual([]);
        });

        it('excludes entries with zero volume', () => {
            const assetCtxs = [
                makeCtx('0'),
                makeCtx('500'),
                makeCtx('0'),
                makeCtx('0'),
                makeCtx('0'),
            ];

            const result = sut.select(BASE_META, assetCtxs, 10);
            const symbols = result.map((t) => t.symbol);

            expect(symbols).toEqual(['UBTC']);
        });

        it('excludes entries with NaN volume', () => {
            const assetCtxs = [
                makeCtx('NaN'),
                makeCtx('200'),
                makeCtx('NaN'),
                makeCtx('0'),
                makeCtx('0'),
            ];

            const result = sut.select(BASE_META, assetCtxs, 10);
            const symbols = result.map((t) => t.symbol);

            expect(symbols).toEqual(['UBTC']);
        });

        it('calls resolver.resolve per token and returns displayName', () => {
            mockResolver.resolve.mockImplementation(
                (t: { name: string; fullName: string | null }) =>
                    t.name === 'UBTC' ? 'BTC' : t.name,
            );
            const assetCtxs = [
                makeCtx('500'),
                makeCtx('1000'),
                makeCtx('300'),
                makeCtx('0'),
                makeCtx('0'),
            ];

            const result = sut.select(BASE_META, assetCtxs, 3);
            const ubtc = result.find((t) => t.symbol === 'UBTC');

            expect(ubtc?.displayName).toBe('BTC');
            expect(mockResolver.resolve).toHaveBeenCalled();
        });

        it('EXCLUDED_STABLECOIN_BASES contains USDT and USDH but not USDC', () => {
            expect(EXCLUDED_STABLECOIN_BASES.has('USDT')).toBe(true);
            expect(EXCLUDED_STABLECOIN_BASES.has('USDH')).toBe(true);
            expect(EXCLUDED_STABLECOIN_BASES.has('USDC')).toBe(false);
        });
    });
});
