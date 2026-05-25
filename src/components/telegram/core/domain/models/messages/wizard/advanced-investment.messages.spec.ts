import { describe, it, expect } from 'vitest';
import { AdvancedInvestmentPromptMessage } from './advanced-investment.messages';
import { Decimal } from '@domain/models/primitives/decimal';

describe('AdvancedInvestmentPromptMessage', () => {
    it('shows basic prompt without params', () => {
        const result = AdvancedInvestmentPromptMessage.create();
        expect(result.text).toContain('How much USDC');
        expect(result.text).toContain('Minimum');
    });

    it('shows balance info when params provided', () => {
        const result = AdvancedInvestmentPromptMessage.create({
            symbol: 'BTC',
            usdcBalance: Decimal.from(1000),
            baseBalance: Decimal.from(0.01),
            baseInUsdc: Decimal.from(950),
            totalBalance: Decimal.from(1950),
            currentPrice: 95000,
            suggestedMax: 800,
            levels: 10,
        });
        expect(result.text).toContain('Your balance');
        expect(result.text).toContain('BTC');
        expect(result.text).toContain('1000');
        expect(result.text).toContain('Suggested max');
    });

    it('shows suggested max for the specified levels', () => {
        const result = AdvancedInvestmentPromptMessage.create({
            symbol: 'ETH',
            usdcBalance: Decimal.from(500),
            baseBalance: Decimal.from(1),
            baseInUsdc: Decimal.from(3000),
            totalBalance: Decimal.from(3500),
            currentPrice: 3000,
            suggestedMax: 400,
            levels: 20,
        });
        expect(result.text).toContain('20 levels');
        expect(result.text).toContain('400');
    });
});
