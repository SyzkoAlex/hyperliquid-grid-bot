import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdvancedLowerStep } from './advanced-lower.step';
import { BotContext } from '../../../types/bot-context';

describe('AdvancedLowerStep', () => {
    let step: AdvancedLowerStep;

    beforeEach(() => {
        step = new AdvancedLowerStep();
    });

    describe('handlePriceInput', () => {
        it('should accept valid lower price', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { upperPrice: 55000 };

            const result = await step.handlePriceInput(ctx, '45000');

            expect(result).toBe('levels');
            expect(ctx.session.createGrid?.lowerPrice).toBe(45000);
        });

        it('should reject lower price >= upper price', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { upperPrice: 50000 };

            const result = await step.handlePriceInput(ctx, '55000');

            expect(result).toBe('invalid');
        });

        it('should reject negative price', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { upperPrice: 50000 };

            const result = await step.handlePriceInput(ctx, '-100');

            expect(result).toBe('invalid');
        });

        it('should reject non-numeric input', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { upperPrice: 50000 };

            const result = await step.handlePriceInput(ctx, 'abc');

            expect(result).toBe('invalid');
        });

        it('should return null if no upper price set', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {};

            const result = await step.handlePriceInput(ctx, '45000');

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
