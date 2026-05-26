import { describe, expect, it } from 'vitest';
import { AdvancedPreviewMessage } from './advanced-preview.messages';

const base = {
    totalInvestment: 1000,
    levels: 10,
    lowerPrice: 45000,
    upperPrice: 55000,
};

describe('AdvancedPreviewMessage', () => {
    it('shows "Ready to create grid?" prompt', () => {
        const result = AdvancedPreviewMessage.create(base);
        expect(result.text).toContain('Ready to create grid?');
    });

    it('shows per-order fee hint in the same format as the investment step', () => {
        // $1000 / 10 levels = $100/order
        // midPrice=50000, gridStep=(55000-45000)/10/50000*100=2.00%
        // profit/cycle=$100*2%=$2.00; fee/cycle=$100*0.04%*2=$0.08
        const result = AdvancedPreviewMessage.create(base);
        expect(result.text).toContain('~$100/order → profit ~$2.00/cycle, fee ~$0.08');
    });

    it('does not show break-even warning when grid is profitable', () => {
        const result = AdvancedPreviewMessage.create(base);
        expect(result.text).not.toContain('Break-even risk');
    });

    it('shows break-even warning when grid step is too tight to cover fees', () => {
        const result = AdvancedPreviewMessage.create({
            totalInvestment: 1000,
            levels: 100,
            lowerPrice: 99990,
            upperPrice: 100000,
        });
        expect(result.text).toContain('Break-even risk');
        expect(result.text).toContain('< 2× fee rate');
    });
});
