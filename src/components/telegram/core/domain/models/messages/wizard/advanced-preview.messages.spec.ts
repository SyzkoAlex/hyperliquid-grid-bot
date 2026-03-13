import { describe, it, expect } from 'vitest';
import { AdvancedPreviewMessage } from './advanced-preview.messages';

describe('AdvancedPreviewMessage', () => {
    const defaultParams = {
        symbol: 'BTC',
        mode: 'Neutral',
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
        expect(result.text).toContain('Neutral');
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
});
