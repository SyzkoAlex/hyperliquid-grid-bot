import { describe, it, expect, beforeEach } from 'vitest';
import { TokenDisplayResolverService } from './token-display-resolver.service';

describe('TokenDisplayResolverService', () => {
    let sut: TokenDisplayResolverService;

    beforeEach(() => {
        sut = new TokenDisplayResolverService();
    });

    describe('resolve', () => {
        it('returns BTC for UBTC with fullName "Unit Bitcoin" (mapped)', () => {
            expect(sut.resolve({ name: 'UBTC', fullName: 'Unit Bitcoin' })).toBe('BTC');
        });

        it('returns SOL for USOL with fullName "Unit Solana" (mapped)', () => {
            expect(sut.resolve({ name: 'USOL', fullName: 'Unit Solana' })).toBe('SOL');
        });

        it('returns ETH for UETH with fullName "Unit Ethereum" (mapped)', () => {
            expect(sut.resolve({ name: 'UETH', fullName: 'Unit Ethereum' })).toBe('ETH');
        });

        it('returns DOGE for UDOGE with fullName "Unit Dogecoin" (mapped)', () => {
            expect(sut.resolve({ name: 'UDOGE', fullName: 'Unit Dogecoin' })).toBe('DOGE');
        });

        it('returns stripped suffix for unknown Unit token (fallback)', () => {
            expect(sut.resolve({ name: 'UXYZ', fullName: 'Unit XYZ' })).toBe('XYZ');
        });

        it('returns name for HYPE whose fullName does not start with "Unit "', () => {
            expect(sut.resolve({ name: 'HYPE', fullName: 'Hyperliquid' })).toBe('HYPE');
        });

        it('returns name for USDC with null fullName', () => {
            expect(sut.resolve({ name: 'USDC', fullName: null })).toBe('USDC');
        });

        it('returns name for PURR with null fullName', () => {
            expect(sut.resolve({ name: 'PURR', fullName: null })).toBe('PURR');
        });

        it('returns name for USDH whose fullName does not start with "Unit "', () => {
            expect(sut.resolve({ name: 'USDH', fullName: 'USDH' })).toBe('USDH');
        });
    });
});
