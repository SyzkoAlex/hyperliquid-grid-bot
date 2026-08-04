import { describe, it, expect } from 'vitest';
import { baseQuantityFromUsdc } from './swap-amount';

describe('baseQuantityFromUsdc', () => {
    it('converts a USDC notional to a base-token quantity via price, formatted to 6dp', () => {
        expect(baseQuantityFromUsdc(55, 10)).toBe('5.500000');
        expect(baseQuantityFromUsdc(541.98, 40.53)).toBe('13.372317');
    });

    it('returns a sentinel instead of Infinity when price is zero', () => {
        expect(baseQuantityFromUsdc(55, 0)).toBe('?');
    });

    it('returns a sentinel instead of a negative quantity when price is negative', () => {
        expect(baseQuantityFromUsdc(55, -10)).toBe('?');
    });

    it('returns a sentinel instead of NaN/Infinity when price is not finite', () => {
        expect(baseQuantityFromUsdc(55, NaN)).toBe('?');
        expect(baseQuantityFromUsdc(55, Infinity)).toBe('?');
    });
});
