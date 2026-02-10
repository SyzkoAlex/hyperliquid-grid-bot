import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdvancedInvestmentStep } from './advanced-investment.step';
import { WizardContext } from '../../../../../core/domain/wizard-context';

describe('AdvancedInvestmentStep', () => {
    let step: AdvancedInvestmentStep;

    beforeEach(() => {
        step = new AdvancedInvestmentStep();
    });

    describe('handleInvestmentInput', () => {
        it('should accept valid investment amount', async () => {
            const ctx = createMockContext();
            ctx.getSession().createGrid = { levels: 10 };

            const result = await step.handleInvestmentInput(ctx, '1000');

            expect(result).toBe('preview');
            expect(ctx.getSession().createGrid?.totalInvestmentUSDC).toBe(1000);
            expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Investment set'));
        });

        it('should reject investment below minimum', async () => {
            const ctx = createMockContext();
            ctx.getSession().createGrid = { levels: 10 };

            const result = await step.handleInvestmentInput(ctx, '5');

            expect(result).toBe('invalid');
            expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Minimum investment'));
        });

        it('should reject non-numeric input', async () => {
            const ctx = createMockContext();
            ctx.getSession().createGrid = { levels: 10 };

            const result = await step.handleInvestmentInput(ctx, 'abc');

            expect(result).toBe('invalid');
            expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Invalid amount'));
        });

        it('should accept decimal amounts', async () => {
            const ctx = createMockContext();
            ctx.getSession().createGrid = { levels: 10 };

            const result = await step.handleInvestmentInput(ctx, '1000.50');

            expect(result).toBe('preview');
            expect(ctx.getSession().createGrid?.totalInvestmentUSDC).toBe(1000.5);
        });

        it('should return null if levels not set', async () => {
            const ctx = createMockContext();
            ctx.getSession().createGrid = {};

            const result = await step.handleInvestmentInput(ctx, '1000');

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
