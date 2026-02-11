import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdvancedLevelsStep } from './advanced-levels.step';
import { BotContext } from '../../../types/bot-context';

describe('AdvancedLevelsStep', () => {
    let step: AdvancedLevelsStep;

    beforeEach(() => {
        step = new AdvancedLevelsStep();
    });

    describe('handleLevelsSelection', () => {
        it('should accept valid level count', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { lowerPrice: 45000 };

            const result = await step.handleLevelsSelection(ctx, 10);

            expect(result).toBe('investment');
            expect(ctx.session.createGrid?.levels).toBe(10);
        });

        it('should reject levels below minimum', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { lowerPrice: 45000 };

            const result = await step.handleLevelsSelection(ctx, 2);

            expect(result).toBe('invalid');
        });

        it('should reject levels above maximum', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { lowerPrice: 45000 };

            const result = await step.handleLevelsSelection(ctx, 101);

            expect(result).toBe('invalid');
        });

        it('should return null if no lower price set', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {};

            const result = await step.handleLevelsSelection(ctx, 10);

            expect(result).toBeNull();
        });
    });

    describe('handleTextInput', () => {
        it('should parse and validate text input', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { lowerPrice: 45000 };

            const result = await step.handleTextInput(ctx, '15');

            expect(result).toBe('investment');
            expect(ctx.session.createGrid?.levels).toBe(15);
        });

        it('should reject non-numeric input', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { lowerPrice: 45000 };

            const result = await step.handleTextInput(ctx, 'abc');

            expect(result).toBe('invalid');
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
