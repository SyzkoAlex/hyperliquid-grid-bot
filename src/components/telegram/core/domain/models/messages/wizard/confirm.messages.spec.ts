import { describe, it, expect } from 'vitest';
import { GridCreatingMessage } from './confirm.messages';

describe('GridCreatingMessage', () => {
    const defaultParams = {
        symbol: 'BTC',
        lowerPrice: 90000,
        upperPrice: 100000,
        levels: 10,
        totalInvestment: 500 as number | undefined,
    };

    it('contains the symbol', () => {
        const result = GridCreatingMessage.create(defaultParams);
        expect(result.text).toContain('BTC');
    });

    it('contains price range', () => {
        const result = GridCreatingMessage.create(defaultParams);
        expect(result.text).toContain('90000');
        expect(result.text).toContain('100000');
    });

    it('contains levels and investment', () => {
        const result = GridCreatingMessage.create(defaultParams);
        expect(result.text).toContain('10');
        expect(result.text).toContain('500');
    });

    it('indicates grid is being created', () => {
        const result = GridCreatingMessage.create(defaultParams);
        expect(result.text).toContain('Creating grid');
    });
});
