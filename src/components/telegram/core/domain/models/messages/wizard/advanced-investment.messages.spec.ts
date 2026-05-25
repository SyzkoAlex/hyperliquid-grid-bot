import { describe, it, expect } from 'vitest';
import { AdvancedInvestmentPromptMessage } from './advanced-investment.messages';
import { Decimal } from '@domain/models/primitives/decimal';

const balanceParams = {
    symbol: 'BTC',
    usdcBalance: Decimal.from(1000),
    baseBalance: Decimal.from(0.01),
    baseInUsdc: Decimal.from(950),
    totalBalance: Decimal.from(1950),
    currentPrice: 95000,
    suggestedMax: 800,
    levels: 10,
    lowerPrice: 76000,
    upperPrice: 114000,
};

describe('AdvancedInvestmentPromptMessage', () => {
    it('shows basic prompt without params', () => {
        const result = AdvancedInvestmentPromptMessage.create();
        expect(result.text).toContain('How much USDC');
        expect(result.text).toContain('Minimum');
    });

    it('shows generic fee rates without params', () => {
        const result = AdvancedInvestmentPromptMessage.create();
        expect(result.text).toContain('Trading fee');
        expect(result.text).toContain('0.07%');
        expect(result.text).toContain('0.04%');
    });

    it('shows balance info when params provided', () => {
        const result = AdvancedInvestmentPromptMessage.create(balanceParams);
        expect(result.text).toContain('Your balance');
        expect(result.text).toContain('BTC');
        expect(result.text).toContain('1000');
        expect(result.text).toContain('Suggested max');
    });

    it('shows per-order fee hint when params provided', () => {
        const result = AdvancedInvestmentPromptMessage.create(balanceParams);
        // $800 / 10 levels = $80/order
        // gridStep = (114000-76000)/10/95000*100 = 4.00%
        // profit/cycle = $80 * 4% = $3.20; fee/cycle = $80 * 0.04% * 2 = $0.06
        expect(result.text).toContain('~$80/order → profit ~$3.20/cycle, fee ~$0.06');
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
            lowerPrice: 2400,
            upperPrice: 3600,
        });
        expect(result.text).toContain('20 levels');
        expect(result.text).toContain('400');
    });
});
