import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QuickStartStep } from './quick-start.step';
import { HyperliquidInfoClient } from '@components/shared/secondary/clients/hyperliquid-info.client';
import { BotContext } from '../../../types/bot-context';
import { Price } from '@domain/primitives/price';

describe('QuickStartStep', () => {
    let step: QuickStartStep;
    let mockHyperliquidClient: HyperliquidInfoClient;

    beforeEach(() => {
        mockHyperliquidClient = {
            getCurrentPrice: vi.fn(),
        } as unknown as HyperliquidInfoClient;

        step = new QuickStartStep(mockHyperliquidClient);
    });

    describe('handleInvestmentInput', () => {
        it('should calculate grid params with ±20% range', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };
            vi.mocked(mockHyperliquidClient.getCurrentPrice).mockResolvedValue(Price.from(50000));

            const result = await step.handleInvestmentInput(ctx, '1000');

            expect(result).toBe('preview');
            expect(ctx.session.createGrid?.totalInvestmentUSDC).toBe(1000);
            expect(ctx.session.createGrid?.upperPrice).toBe(60000); // 50000 + 20%
            expect(ctx.session.createGrid?.lowerPrice).toBe(40000); // 50000 - 20%
            expect(ctx.session.createGrid?.levels).toBe(10);
        });

        it('should reject investment below minimum', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };

            const result = await step.handleInvestmentInput(ctx, '5');

            expect(result).toBe('invalid');
        });

        it('should reject invalid number', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };

            const result = await step.handleInvestmentInput(ctx, 'invalid');

            expect(result).toBe('invalid');
        });

        it('should handle API error gracefully', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };
            vi.mocked(mockHyperliquidClient.getCurrentPrice).mockRejectedValue(
                new Error('API error'),
            );

            const result = await step.handleInvestmentInput(ctx, '1000');

            expect(result).toBe('invalid');
        });

        it('should return null if no symbol in session', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {};

            const result = await step.handleInvestmentInput(ctx, '1000');

            expect(result).toBeNull();
        });
    });

    function createMockContext(): BotContext {
        const session = { createGrid: {} };
        return {
            reply: vi.fn(),
            session,
            scene: { leave: vi.fn() },
        } as unknown as BotContext;
    }
});
