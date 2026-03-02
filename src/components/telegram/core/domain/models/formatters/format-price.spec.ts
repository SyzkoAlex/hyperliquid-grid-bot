import { describe, it, expect } from 'vitest';
import { formatPrice } from './format-price';

describe('formatPrice', () => {
    it('formats exact values without ~', () => {
        expect(formatPrice(1234.56)).toBe('$1,234.56');
        expect(formatPrice(100)).toBe('$100.00');
        expect(formatPrice(0.5)).toBe('$0.50');
    });

    it('prepends ~ when rounding occurs', () => {
        expect(formatPrice(1234.567)).toBe('~$1,234.57');
        expect(formatPrice(0.001)).toBe('~$0.00');
        expect(formatPrice(99.999)).toBe('~$100.00');
    });

    it('handles zero', () => {
        expect(formatPrice(0)).toBe('$0.00');
    });

    it('handles negative values', () => {
        expect(formatPrice(-42.99)).toBe('$-42.99');
        expect(formatPrice(-0.005)).toBe('~$-0.01');
    });
});
