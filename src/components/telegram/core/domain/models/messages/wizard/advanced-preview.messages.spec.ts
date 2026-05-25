import { describe, expect, it } from 'vitest';
import { AdvancedPreviewMessage } from './advanced-preview.messages';
import { GridFeeMetrics } from '../../grid-fee-calculator';

describe('AdvancedPreviewMessage', () => {
    it('shows "Ready to create grid?" prompt', () => {
        const result = AdvancedPreviewMessage.create({ totalInvestment: 500 });
        expect(result.text).toContain('Ready to create grid?');
    });

    it('omits fee block when feeMetrics not provided', () => {
        const result = AdvancedPreviewMessage.create({ totalInvestment: 500 });
        expect(result.text).not.toContain('Fee per grid cycle');
        expect(result.text).not.toContain('Profit per grid');
    });

    it('shows fee block when feeMetrics provided and profitable', () => {
        const feeMetrics: GridFeeMetrics = {
            feePerCycle: 0.4,
            profitPerGridPct: 0.9753,
            gridStepPct: 1.0553,
            isProfitable: true,
        };
        const result = AdvancedPreviewMessage.create({ totalInvestment: 500, feeMetrics });
        expect(result.text).toContain('Fee per grid cycle');
        expect(result.text).toContain('0.40');
        expect(result.text).toContain('Profit per grid');
        expect(result.text).not.toContain('Break-even risk');
    });

    it('shows break-even warning when not profitable', () => {
        const feeMetrics: GridFeeMetrics = {
            feePerCycle: 0.4,
            profitPerGridPct: -0.04,
            gridStepPct: 0.04,
            isProfitable: false,
        };
        const result = AdvancedPreviewMessage.create({ totalInvestment: 500, feeMetrics });
        expect(result.text).toContain('Break-even risk');
        expect(result.text).toContain('< 2× fee rate');
    });
});
