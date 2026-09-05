import { describe, it, expect } from 'vitest';
import { AiStartMessages } from './ai-start.messages';
import { PredictionWarning } from '@components/prediction/api/dto/prediction-warning';
import { Decimal } from '@domain/models/primitives/decimal';

const suggestionParams = {
    symbol: 'HYPE',
    lowerPrice: 40.5,
    upperPrice: 55.25,
    orderCount: 15,
    conservativePnlUsdc: 12.5,
    periodDays: 7,
    warnings: [] as PredictionWarning[],
};

describe('AiStartMessages', () => {
    describe('loading', () => {
        it('contains the symbol being analyzed', () => {
            const result = AiStartMessages.loading('HYPE');
            expect(result).toContain('HYPE');
            expect(result).toContain('AI mode');
        });
    });

    describe('suggestionBlock', () => {
        it('shows the suggested range and order count', () => {
            const result = AiStartMessages.suggestionBlock(suggestionParams);
            expect(result).toContain('$40.5 – $55.25');
            expect(result).toContain('15 orders');
        });

        it('renders the backtest headline with the test-budget qualifier', () => {
            const result = AiStartMessages.suggestionBlock(suggestionParams);
            expect(result).toContain('Backtest: +$12.50 per 7 days');
            expect(result).toContain('$1,000 test budget');
            expect(result).toContain('not a forecast');
        });

        it('renders a negative headline with a minus sign', () => {
            const result = AiStartMessages.suggestionBlock({
                ...suggestionParams,
                conservativePnlUsdc: -3.75,
            });
            expect(result).toContain('Backtest: -$3.75');
        });

        it('omits the headline when conservativePnlUsdc is null', () => {
            const result = AiStartMessages.suggestionBlock({
                ...suggestionParams,
                conservativePnlUsdc: null,
            });
            expect(result).not.toContain('Backtest');
            expect(result).toContain('15 orders');
        });

        it('renders human-readable warning lines', () => {
            const result = AiStartMessages.suggestionBlock({
                ...suggestionParams,
                warnings: [PredictionWarning.TrendingRegime, PredictionWarning.LowLiquidity],
            });
            expect(result).toContain('Trending regime detected');
            expect(result).toContain('Low trading volume');
        });

        it('omits warning lines when there are no warnings', () => {
            const result = AiStartMessages.suggestionBlock(suggestionParams);
            expect(result).not.toContain('⚠️');
        });
    });

    describe('fallbackNotice', () => {
        it('mentions the ±20% default range and 10 orders', () => {
            const result = AiStartMessages.fallbackNotice();
            expect(result).toContain('±20%');
            expect(result).toContain('10 orders');
            expect(result).toContain('AI suggestion is unavailable');
        });
    });

    describe('prompt', () => {
        it('prepends the header and shows the generic fee hint without balance', () => {
            const result = AiStartMessages.prompt('HEADER BLOCK');
            expect(result.startsWith('HEADER BLOCK')).toBe(true);
            expect(result).toContain('How much to invest?');
            expect(result).toContain('Trading fee');
        });

        it('shows balance details and the suggested order count with balance', () => {
            const result = AiStartMessages.prompt('HEADER BLOCK', {
                symbol: 'HYPE',
                usdcBalance: Decimal.from(2000),
                baseBalance: Decimal.from(50),
                baseInUsdc: Decimal.from(2500),
                totalBalance: Decimal.from(4500),
                currentPrice: 50,
                suggestedMax: 1200,
                lowerPrice: 40,
                upperPrice: 60,
                orderCount: 15,
            });
            expect(result.startsWith('HEADER BLOCK')).toBe(true);
            expect(result).toContain('Available: ~4,500 USDC');
            expect(result).toContain('2,000 USDC + 50 HYPE');
            expect(result).toContain('Recommended: ~1200 USDC for 15 orders');
            expect(result).toContain('/order');
        });
    });
});
