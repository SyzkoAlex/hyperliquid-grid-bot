import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HyperliquidMetaService } from './hyperliquid-meta.service';
import { SpotMeta } from '../types/hyperliquid-spot-meta';

const SPOT_META: SpotMeta = {
    tokens: [
        { name: 'USDC', index: 0, szDecimals: 8, fullName: null, isCanonical: true },
        { name: 'HYPE', index: 1, szDecimals: 5, fullName: 'Hyperliquid', isCanonical: false },
        { name: 'BTC', index: 2, szDecimals: 6, fullName: 'Unit Bitcoin', isCanonical: false },
    ],
    universe: [
        { name: '@35', tokens: [1, 0], index: 35, isCanonical: false },
        { name: '@12', tokens: [2, 0], index: 12, isCanonical: false },
    ],
};

function makeHttp(meta: SpotMeta = SPOT_META) {
    return { postInfo: vi.fn().mockResolvedValue(meta), postExchange: vi.fn() };
}

describe('HyperliquidMetaService', () => {
    let sut: HyperliquidMetaService;

    beforeEach(async () => {
        sut = new HyperliquidMetaService(makeHttp() as never);
        await sut.onModuleInit();
    });

    describe('getSpotAssetIndex', () => {
        it('should return 10000 + universeIndex for HYPE', () => {
            expect(sut.getSpotAssetIndex('HYPE')).toBe(10035);
        });

        it('should return 10000 + universeIndex for BTC', () => {
            expect(sut.getSpotAssetIndex('BTC')).toBe(10012);
        });

        it('should throw when symbol not found', () => {
            expect(() => sut.getSpotAssetIndex('UNKNOWN')).toThrow(
                'Token not found for symbol: UNKNOWN',
            );
        });
    });

    describe('getSzDecimals', () => {
        it('should return szDecimals for known token', () => {
            expect(sut.getSzDecimals('HYPE')).toBe(5);
        });
    });

    describe('lookupSpotKey', () => {
        it('should return @universeIndex for known symbol', () => {
            expect(sut.lookupSpotKey('HYPE')).toBe('@35');
        });
    });

    describe('resolveSpotSymbol', () => {
        it('should resolve @tokenIndex to symbol name', () => {
            expect(sut.resolveSpotSymbol('@1')).toBe('HYPE');
        });

        it('should return plain symbol unchanged', () => {
            expect(sut.resolveSpotSymbol('HYPE')).toBe('HYPE');
        });
    });
});
