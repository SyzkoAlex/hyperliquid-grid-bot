import { describe, expect, it } from 'vitest';
import { AdvancedPreviewMessage } from './advanced-preview.messages';

const base = {
    totalInvestment: 1000,
    orderCount: 10,
    lowerPrice: 45000,
    upperPrice: 55000,
};

describe('AdvancedPreviewMessage', () => {
    it('shows "Ready to create grid?" prompt', () => {
        const result = AdvancedPreviewMessage.create(base);
        expect(result.text).toContain('Ready to create grid?');
    });

    it('shows per-order fee hint in the same format as the investment step', () => {
        // $1000 / 10 orders = $100/order
        // midPrice=50000, gridStep=(55000-45000)/9/50000*100≈2.2222%
        // profit/cycle=$100*2.2222%≈$2.22; fee/cycle=$100*0.04%*2=$0.08
        const result = AdvancedPreviewMessage.create(base);
        expect(result.text).toContain('~$100/order → profit ~$2.22/cycle, fee ~$0.08');
    });

    it('does not show break-even warning when grid is profitable', () => {
        const result = AdvancedPreviewMessage.create(base);
        expect(result.text).not.toContain('Break-even risk');
    });

    it('shows break-even warning when grid step is too tight to cover fees', () => {
        const result = AdvancedPreviewMessage.create({
            totalInvestment: 1000,
            orderCount: 100,
            lowerPrice: 99990,
            upperPrice: 100000,
        });
        expect(result.text).toContain('Break-even risk');
        expect(result.text).toContain('< 2× fee rate');
    });

    it('shows the capacity line when capacityMax is provided', () => {
        const result = AdvancedPreviewMessage.create({
            totalInvestment: 326,
            orderCount: 10,
            lowerPrice: 45000,
            upperPrice: 55000,
            capacityMax: 1304,
        });
        expect(result.text).toContain('$326.00 of $1,304.00 max for this grid (25%)');
    });

    it('omits the capacity line when capacityMax is absent', () => {
        const result = AdvancedPreviewMessage.create(base);
        expect(result.text).not.toContain('max for this grid');
    });

    it('omits the capacity line when capacityMax is zero (no divide-by-zero)', () => {
        const result = AdvancedPreviewMessage.create({ ...base, capacityMax: 0 });
        expect(result.text).not.toContain('max for this grid');
        expect(result.text).not.toContain('NaN');
        expect(result.text).not.toContain('Infinity');
    });
});
