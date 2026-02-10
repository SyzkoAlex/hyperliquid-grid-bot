import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdvancedLevelsStep } from './advanced-levels.step';
import { WizardContext } from '../../../../../core/domain/wizard-context';

describe('AdvancedLevelsStep', () => {
    let step: AdvancedLevelsStep;

    beforeEach(() => {
        step = new AdvancedLevelsStep();
    });

    describe('handleLevelsSelection', () => {
        it('should accept valid level count', async () => {
            const ctx = createMockContext();
            ctx.getSession().createGrid = { lowerPrice: 45000 };

            const result = await step.handleLevelsSelection(ctx, 10);

            expect(result).toBe('investment');
            expect(ctx.getSession().createGrid?.levels).toBe(10);
            expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Grid levels set'));
        });

        it('should reject levels below minimum', async () => {
            const ctx = createMockContext();
            ctx.getSession().createGrid = { lowerPrice: 45000 };

            const result = await step.handleLevelsSelection(ctx, 2);

            expect(result).toBe('invalid');
            expect(ctx.reply).toHaveBeenCalledWith(
                expect.stringContaining('Must be between 3 and 100'),
            );
        });

        it('should reject levels above maximum', async () => {
            const ctx = createMockContext();
            ctx.getSession().createGrid = { lowerPrice: 45000 };

            const result = await step.handleLevelsSelection(ctx, 101);

            expect(result).toBe('invalid');
        });

        it('should return null if no lower price set', async () => {
            const ctx = createMockContext();
            ctx.getSession().createGrid = {};

            const result = await step.handleLevelsSelection(ctx, 10);

            expect(result).toBeNull();
        });
    });

    describe('handleTextInput', () => {
        it('should parse and validate text input', async () => {
            const ctx = createMockContext();
            ctx.getSession().createGrid = { lowerPrice: 45000 };

            const result = await step.handleTextInput(ctx, '15');

            expect(result).toBe('investment');
            expect(ctx.getSession().createGrid?.levels).toBe(15);
        });

        it('should reject non-numeric input', async () => {
            const ctx = createMockContext();
            ctx.getSession().createGrid = { lowerPrice: 45000 };

            const result = await step.handleTextInput(ctx, 'abc');

            expect(result).toBe('invalid');
            expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Invalid input'));
        });
    });

    function createMockContext(): WizardContext {
        const session = { createGrid: {} };
        return {
            reply: vi.fn(),
            getSession: vi.fn(() => session),
            leaveScene: vi.fn(),
        } as unknown as WizardContext;
    }
});
