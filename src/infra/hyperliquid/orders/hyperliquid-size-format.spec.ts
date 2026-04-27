import { describe, it, expect } from 'vitest';
import { roundToDecimals, floorToDecimals, ceilToDecimals } from './hyperliquid-size-format';

describe('hyperliquid-size-format', () => {
    describe('roundToDecimals', () => {
        it('should round to specified decimal places', () => {
            expect(roundToDecimals(0.123456, 2)).toBe(0.12);
        });

        it('should round up when next digit is 5 or more', () => {
            expect(roundToDecimals(0.125, 2)).toBe(0.13);
        });

        it('should handle integer decimals (0)', () => {
            expect(roundToDecimals(1.6, 0)).toBe(2);
        });
    });

    describe('floorToDecimals', () => {
        it('should truncate to specified decimal places without exceeding available balance', () => {
            expect(floorToDecimals(0.129, 2)).toBe(0.12);
        });

        it('should truncate even when very close to next value', () => {
            expect(floorToDecimals(0.129999, 2)).toBe(0.12);
        });

        it('should handle exact values without change', () => {
            expect(floorToDecimals(0.12, 2)).toBe(0.12);
        });
    });

    describe('ceilToDecimals', () => {
        it('should round up to keep notional above exchange minimum', () => {
            expect(ceilToDecimals(0.121, 2)).toBe(0.13);
        });

        it('should not change exact values', () => {
            expect(ceilToDecimals(0.12, 2)).toBe(0.12);
        });

        it('should round up even a tiny fraction', () => {
            expect(ceilToDecimals(0.120001, 2)).toBe(0.13);
        });
    });
});
