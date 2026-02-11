import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdvancedUpperStep } from './advanced-upper.step';
import { HyperliquidInfoClient } from '@components/shared/secondary/clients/hyperliquid-info.client';
import { BotContext } from '../../../types/bot-context';
import { Price } from '@domain/primitives/price';

describe('AdvancedUpperStep', () => {
    let step: AdvancedUpperStep;
    let mockHyperliquidClient: HyperliquidInfoClient;

    beforeEach(() => {
        mockHyperliquidClient = {
            getCurrentPrice: vi.fn(),
        } as unknown as HyperliquidInfoClient;

        step = new AdvancedUpperStep(mockHyperliquidClient);
    });

    describe('enter', () => {
        it('should show current price if symbol exists', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };
            vi.mocked(mockHyperliquidClient.getCurrentPrice).mockResolvedValue(Price.from(50000));

            await step.enter(ctx);

            expect(ctx.reply).toHaveBeenCalled();
        });

        it('should handle price fetch error gracefully', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };
            vi.mocked(mockHyperliquidClient.getCurrentPrice).mockRejectedValue(
                new Error('API error'),
            );

            await step.enter(ctx);

            expect(ctx.reply).toHaveBeenCalled();
        });
    });

    describe('handlePriceInput', () => {
        it('should accept valid upper price', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {};

            const result = await step.handlePriceInput(ctx, '55000');

            expect(result).toBe('lower');
            expect(ctx.session.createGrid?.upperPrice).toBe(55000);
        });

        it('should reject zero or negative price', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {};

            const result = await step.handlePriceInput(ctx, '0');

            expect(result).toBe('invalid');
        });

        it('should reject non-numeric input', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {};

            const result = await step.handlePriceInput(ctx, 'abc');

            expect(result).toBe('invalid');
        });

        it('should return null if session not initialized', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = undefined;

            const result = await step.handlePriceInput(ctx, '55000');

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
