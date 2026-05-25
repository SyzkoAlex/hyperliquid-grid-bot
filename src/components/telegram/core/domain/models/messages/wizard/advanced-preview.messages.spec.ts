import { describe, expect, it } from 'vitest';
import { AdvancedPreviewMessage } from './advanced-preview.messages';

describe('AdvancedPreviewMessage', () => {
    const defaultParams = {
        symbol: 'BTC',
        lowerPrice: 90000,
        upperPrice: 100000,
        currentPrice: 95000 as number | null,
        levels: 10,
        totalInvestment: 500,
        orderSize: '50.00',
    };

    it('contains all key grid fields', () => {
        const result = AdvancedPreviewMessage.create(defaultParams);
        expect(result.text).toContain('BTC');
        expect(result.text).toContain('90000');
        expect(result.text).toContain('100000');
        expect(result.text).toContain('10');
        expect(result.text).toContain('500');
    });

    it('shows current price when provided', () => {
        const result = AdvancedPreviewMessage.create(defaultParams);
        expect(result.text).toContain('95000');
        expect(result.text).toContain('Current Price');
    });

    it('omits current price line when null', () => {
        const result = AdvancedPreviewMessage.create({ ...defaultParams, currentPrice: null });
        expect(result.text).not.toContain('Current Price');
    });

    it('shows order size per level', () => {
        const result = AdvancedPreviewMessage.create(defaultParams);
        expect(result.text).toContain('50.00');
        expect(result.text).toContain('per level');
    });

    it('omits fee block when fee params not provided', () => {
        const result = AdvancedPreviewMessage.create(defaultParams);
        expect(result.text).not.toContain('Fee per grid cycle');
        expect(result.text).not.toContain('Profit per grid');
    });

    it('shows fee block when fee params provided', () => {
        const result = AdvancedPreviewMessage.create({
            ...defaultParams,
            feePerCycle: 0.7,
            profitPerGridPct: 0.9153,
            gridStepPct: 1.0553,
            breakEven: true,
        });
        expect(result.text).toContain('Fee per grid cycle');
        expect(result.text).toContain('0.70');
        expect(result.text).toContain('Profit per grid');
        expect(result.text).not.toContain('Break-even risk');
    });

    it('shows break-even warning when profitPerGridPct <= 0', () => {
        const result = AdvancedPreviewMessage.create({
            ...defaultParams,
            feePerCycle: 0.7,
            profitPerGridPct: -0.04,
            gridStepPct: 0.1,
            breakEven: false,
        });
        expect(result.text).toContain('Break-even risk');
        expect(result.text).toContain('< 2× fee rate');
    });
});
