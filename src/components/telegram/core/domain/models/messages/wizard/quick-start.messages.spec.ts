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
        expect(result.text).toContain('How much USDC');
        expect(result.text).toContain('Minimum');
    });

    it('shows generic fee rates without params', () => {
        const result = QuickStartPromptMessage.create();
        expect(result.text).toContain('Trading fee');
        expect(result.text).toContain('0.07%');
        expect(result.text).toContain('0.04%');
    });

    it('shows balance info when params provided', () => {
        const result = QuickStartPromptMessage.create(balanceParams);
        expect(result.text).toContain('Your balance');
        expect(result.text).toContain('BTC');
        expect(result.text).toContain('2000');
        expect(result.text).toContain('Suggested max');
        expect(result.text).toContain('1200');
    });

    it('shows per-order fee hint when params provided', () => {
        const result = QuickStartPromptMessage.create(balanceParams);
        // $1200 / 10 levels = $120/order
        // gridStep = (114000-76000)/10/95000*100 = 4.00%
        // profit/cycle = $120 * 4% = $4.80; fee/cycle = $120 * 0.04% * 2 = $0.10
        expect(result.text).toContain('~$120/order → profit ~$4.80/cycle, fee ~$0.10');
    });

    it('uses default levels in suggested max text', () => {
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
});
