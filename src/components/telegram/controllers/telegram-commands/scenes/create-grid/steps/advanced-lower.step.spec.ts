import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdvancedLowerStep } from './advanced-lower.step';
import { WizardContext } from '../../../../../core/domain/wizard-context';

describe('AdvancedLowerStep', () => {
    let step: AdvancedLowerStep;

    beforeEach(() => {
        step = new AdvancedLowerStep();
    });

    describe('handlePriceInput', () => {
        it('should accept valid lower price', async () => {
            const ctx = createMockContext();
            ctx.getSession().createGrid = { upperPrice: 55000 };

            const result = await step.handlePriceInput(ctx, '45000');

            expect(result).toBe('levels');
            expect(ctx.getSession().createGrid?.lowerPrice).toBe(45000);
            expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Lower price set'));
        });

        it('should reject lower price >= upper price', async () => {
            const ctx = createMockContext();
            ctx.getSession().createGrid = { upperPrice: 50000 };

            const result = await step.handlePriceInput(ctx, '55000');

            expect(result).toBe('invalid');
            expect(ctx.reply).toHaveBeenCalledWith(
                expect.stringContaining('must be less than upper price'),
            );
        });

        it('should reject negative price', async () => {
            const ctx = createMockContext();
            ctx.getSession().createGrid = { upperPrice: 50000 };

            const result = await step.handlePriceInput(ctx, '-100');

            expect(result).toBe('invalid');
            expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Invalid price'));
        });

        it('should reject non-numeric input', async () => {
            const ctx = createMockContext();
            ctx.getSession().createGrid = { upperPrice: 50000 };

            const result = await step.handlePriceInput(ctx, 'abc');

            expect(result).toBe('invalid');
        });

        it('should return null if no upper price set', async () => {
            const ctx = createMockContext();
            ctx.getSession().createGrid = {};

            const result = await step.handlePriceInput(ctx, '45000');

            expect(result).toBeNull();
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
