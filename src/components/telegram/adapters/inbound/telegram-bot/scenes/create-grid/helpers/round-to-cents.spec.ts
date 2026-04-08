import { describe, expect, it } from 'vitest';
import { roundToCents } from './round-to-cents';

describe('roundToCents', () => {
    it('rounds down when third decimal is below 5', () => {
        expect(roundToCents(9.994)).toBe(9.99);
    });

    it('rounds up when third decimal is 5 or above', () => {
        expect(roundToCents(9.996)).toBe(10.0);
        expect(roundToCents(9.999)).toBe(10.0);
    });

    it('leaves already-rounded values unchanged', () => {
        expect(roundToCents(10.0)).toBe(10.0);
        expect(roundToCents(0.5)).toBe(0.5);
    });

    it('handles zero', () => {
        expect(roundToCents(0)).toBe(0);
    });

    it('handles negative values', () => {
        expect(roundToCents(-9.999)).toBe(-10.0);
        expect(roundToCents(-9.994)).toBe(-9.99);
    });

    it('handles large numbers', () => {
        expect(roundToCents(12345.6789)).toBe(12345.68);
    });
});
