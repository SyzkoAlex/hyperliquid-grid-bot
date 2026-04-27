import { describe, it, expect } from 'vitest';
import { HyperliquidSymbol } from './hyperliquid-symbol';

describe('HyperliquidSymbol', () => {
    describe('toSpotFormat', () => {
        it('should append -SPOT suffix to symbol', () => {
            expect(HyperliquidSymbol.toSpotFormat('ETH')).toBe('ETH-SPOT');
        });

        it('should append -SPOT suffix to any symbol', () => {
            expect(HyperliquidSymbol.toSpotFormat('BTC')).toBe('BTC-SPOT');
        });
    });

    describe('stripSpotSuffix', () => {
        it('should remove -SPOT suffix from symbol', () => {
            expect(HyperliquidSymbol.stripSpotSuffix('ETH-SPOT')).toBe('ETH');
        });

        it('should return symbol unchanged when no -SPOT suffix', () => {
            expect(HyperliquidSymbol.stripSpotSuffix('ETH')).toBe('ETH');
        });
    });

    describe('hasSpotSuffix', () => {
        it('should return true for symbol with -SPOT suffix', () => {
            expect(HyperliquidSymbol.hasSpotSuffix('ETH-SPOT')).toBe(true);
        });

        it('should return false for symbol without -SPOT suffix', () => {
            expect(HyperliquidSymbol.hasSpotSuffix('ETH')).toBe(false);
        });
    });
});
