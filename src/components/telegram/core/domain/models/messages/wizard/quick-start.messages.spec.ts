import { describe, it, expect } from 'vitest';
import { QuickStartPromptMessage, QuickStartConfirmationMessage } from './quick-start.messages';
import { Decimal } from '@domain/models/primitives/decimal';

describe('QuickStartPromptMessage', () => {
    it('shows basic prompt without params', () => {
        const result = QuickStartPromptMessage.create();
        expect(result.text).toContain('How much USDC');
        expect(result.text).toContain('Minimum');
    });

    it('shows balance info when params provided', () => {
        const result = QuickStartPromptMessage.create({
            symbol: 'BTC',
            usdcBalance: Decimal.from(2000),
            baseBalance: Decimal.from(0.05),
            baseInUsdc: Decimal.from(4750),
            totalBalance: Decimal.from(6750),
            currentPrice: 95000,
            suggestedMax: 1200,
        });
        expect(result.text).toContain('Your balance');
        expect(result.text).toContain('BTC');
        expect(result.text).toContain('2000');
        expect(result.text).toContain('Suggested max');
        expect(result.text).toContain('1200');
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
        });
        expect(result.text).toContain('10 levels');
    });
});

describe('QuickStartConfirmationMessage', () => {
    it('contains the investment amount', () => {
        const result = QuickStartConfirmationMessage.create(300);
        expect(result.text).toContain('300');
    });

    it('shows USDC denomination', () => {
        const result = QuickStartConfirmationMessage.create(100);
        expect(result.text).toContain('USDC');
    });
});
