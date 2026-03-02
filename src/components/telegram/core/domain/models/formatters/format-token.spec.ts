import { describe, it, expect } from 'vitest';
import { formatToken } from './format-token';

describe('formatToken', () => {
    it('returns exact value when no rounding needed', () => {
        expect(formatToken(0.00345)).toBe('0.00345');
        expect(formatToken(1.5)).toBe('1.5');
        expect(formatToken(100)).toBe('100');
        expect(formatToken(0.1)).toBe('0.1');
    });

    it('prepends ~ when rounding occurs', () => {
        expect(formatToken(0.00345123456)).toBe('~0.00345');
        expect(formatToken(1.123456)).toBe('~1.12346');
        expect(formatToken(0.000001)).toBe('~0');
    });

    it('trims trailing zeros', () => {
        expect(formatToken(1.1)).toBe('1.1');
        expect(formatToken(5)).toBe('5');
    });

    it('handles zero', () => {
        expect(formatToken(0)).toBe('0');
    });
});
