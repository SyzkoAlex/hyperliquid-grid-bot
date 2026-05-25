import { describe, expect, it } from 'vitest';
import { calculateGridFeeMetrics } from './grid-fee-calculator';

describe('calculateGridFeeMetrics', () => {
    const base = {
        lowerPrice: 90000,
        upperPrice: 100000,
        levels: 10,
        totalInvestment: 1000,
    };

    it('computes feePerCycle as totalInvestment * makerRate * 2', () => {
        // 1000 * 0.0004 * 2 = 0.8
        const { feePerCycle } = calculateGridFeeMetrics(base);
        expect(feePerCycle).toBeCloseTo(0.8, 6);
    });

    it('computes gridStepPct correctly', () => {
        // range=10000, levels=10, midPrice=95000 → step=1000/95000*100 ≈ 1.0526%
        const { gridStepPct } = calculateGridFeeMetrics(base);
        expect(gridStepPct).toBeCloseTo(1.0526, 3);
    });

    it('computes profitPerGridPct = gridStepPct - 2*makerRate*100', () => {
        const { gridStepPct, profitPerGridPct } = calculateGridFeeMetrics(base);
        // 2 * 0.0004 * 100 = 0.08
        expect(profitPerGridPct).toBeCloseTo(gridStepPct - 0.08, 6);
    });

    it('isProfitable true when gridStep covers fees', () => {
        const { isProfitable } = calculateGridFeeMetrics(base);
        expect(isProfitable).toBe(true);
    });

    it('isProfitable false when grid is too tight to cover fees', () => {
        // Very tight range: 1% total spread across 100 levels → step ≈ 0.0001% — far below 2*0.04%
        const { isProfitable } = calculateGridFeeMetrics({
            lowerPrice: 99990,
            upperPrice: 100000,
            levels: 100,
            totalInvestment: 1000,
        });
        expect(isProfitable).toBe(false);
    });
});
