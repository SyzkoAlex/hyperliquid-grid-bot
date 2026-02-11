import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdvancedInvestmentStep } from './advanced-investment.step';
import { BotContext } from '../../../types/bot-context';

describe('AdvancedInvestmentStep', () => {
    let step: AdvancedInvestmentStep;

    beforeEach(() => {
        step = new AdvancedInvestmentStep();
    });

    describe('handleInvestmentInput', () => {
        it('should accept valid investment amount', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { levels: 10 };

            const result = await step.handleInvestmentInput(ctx, '1000');

            expect(result).toBe('preview');
            expect(ctx.session.createGrid?.totalInvestmentUSDC).toBe(1000);
        });

        it('should reject investment below minimum', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { levels: 10 };

            const result = await step.handleInvestmentInput(ctx, '5');

            expect(result).toBe('invalid');
        });

        it('should reject non-numeric input', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { levels: 10 };

            const result = await step.handleInvestmentInput(ctx, 'abc');

            expect(result).toBe('invalid');
        });

        it('should accept decimal amounts', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { levels: 10 };

            const result = await step.handleInvestmentInput(ctx, '1000.50');

            expect(result).toBe('preview');
            expect(ctx.session.createGrid?.totalInvestmentUSDC).toBe(1000.5);
        });

        it('should return null if levels not set', async () => {
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
