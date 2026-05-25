import { describe, it, expect } from 'vitest';
import { QuickStartPromptMessage } from './quick-start.messages';
import { Decimal } from '@domain/models/primitives/decimal';

const balanceParams = {
    symbol: 'BTC',
    usdcBalance: Decimal.from(2000),
    baseBalance: Decimal.from(0.05),
    baseInUsdc: Decimal.from(4750),
    totalBalance: Decimal.from(6750),
    currentPrice: 95000,
    suggestedMax: 1200,
    lowerPrice: 76000,
    upperPrice: 114000,
};

describe('QuickStartPromptMessage', () => {
    it('shows basic prompt without params', () => {
        const result = QuickStartPromptMessage.create();
        expect(result.text).toContain('How much to invest?');
    });

    it('shows generic fee rates without params', () => {
        const result = QuickStartPromptMessage.create();
        expect(result.text).toContain('Trading fee');
        expect(result.text).toContain('0.07%');
        expect(result.text).toContain('0.04%');
    });

    it('shows available total balance prominently', () => {
        const result = QuickStartPromptMessage.create(balanceParams);
        expect(result.text).toContain('Available: ~6,750 USDC');
    });

    it('shows USDC and base token breakdown', () => {
        const result = QuickStartPromptMessage.create(balanceParams);
        expect(result.text).toContain('2,000 USDC + 0.05 BTC');
    });

    it('shows recommended amount and levels', () => {
        const result = QuickStartPromptMessage.create(balanceParams);
        expect(result.text).toContain('Recommended: ~1200 USDC for 10 levels');
    });

    it('shows per-order fee hint when params provided', () => {
        const result = QuickStartPromptMessage.create(balanceParams);
        // $1200 / 10 levels = $120/order
        // gridStep = (114000-76000)/10/95000*100 = 4.00%
        // profit/cycle = $120 * 4% = $4.80; fee/cycle = $120 * 0.04% * 2 = $0.10
        expect(result.text).toContain('~$120/order → profit ~$4.80/cycle, fee ~$0.10');
    });

    it('uses default levels in recommended text', () => {
        const result = QuickStartPromptMessage.create({
            symbol: 'ETH',
            usdcBalance: Decimal.from(500),
            baseBalance: Decimal.from(1),
            baseInUsdc: Decimal.from(3000),
            totalBalance: Decimal.from(3500),
            currentPrice: 3000,
            suggestedMax: 400,
            lowerPrice: 2400,
            upperPrice: 3600,
        });
        expect(result.text).toContain('10 levels');
    });

    it('does not repeat price info already shown in board summary', () => {
        const result = QuickStartPromptMessage.create(balanceParams);
        expect(result.text).not.toContain('BTC price:');
        expect(result.text).not.toContain('Your balance:');
        expect(result.text).not.toContain('Total balance:');
    });

    it('rounds USDC balance to whole number', () => {
        const result = QuickStartPromptMessage.create({
            ...balanceParams,
            usdcBalance: Decimal.from(5219.994),
            totalBalance: Decimal.from(6771.1),
        });
        expect(result.text).toContain('5,220 USDC');
        expect(result.text).toContain('~6,771 USDC');
    });
});
