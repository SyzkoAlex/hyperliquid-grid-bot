import { describe, it, expect } from 'vitest';
import { formatFiat } from './format-fiat';

describe('formatFiat', () => {
    it('rounds to 2 decimal places', () => {
        expect(formatFiat(1.456)).toBe('1.46');
        expect(formatFiat(1.454)).toBe('1.45');
    });

    it('pads with trailing zeros', () => {
        expect(formatFiat(5)).toBe('5.00');
        expect(formatFiat(0.1)).toBe('0.10');
    });

    it('adds thousand separators', () => {
        expect(formatFiat(1234.5)).toBe('1,234.50');
        expect(formatFiat(1000000)).toBe('1,000,000.00');
    });

    it('handles zero', () => {
        expect(formatFiat(0)).toBe('0.00');
    });

    it('handles negative values', () => {
        expect(formatFiat(-42.999)).toBe('-43.00');
        expect(formatFiat(-0.005)).toBe('-0.01');
    });

    it('rounds half values correctly', () => {
        expect(formatFiat(0.005)).toBe('0.01');
        expect(formatFiat(1.235)).toBe('1.24');
        expect(formatFiat(2.345)).toBe('2.35');
    });

    it('handles very small values', () => {
        expect(formatFiat(0.001)).toBe('0.00');
        expect(formatFiat(0.009)).toBe('0.01');
    });
});
