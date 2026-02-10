import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdvancedPreviewStep } from './advanced-preview.step';
import { WizardContext } from '../../../../../core/domain/wizard-context';
import { CreateGridMode } from '../../../../../core/domain/grid-mode';

describe('AdvancedPreviewStep', () => {
    let step: AdvancedPreviewStep;

    beforeEach(() => {
        step = new AdvancedPreviewStep();
    });

    describe('enter', () => {
        it('should display complete grid configuration', async () => {
            const ctx = createMockContext();
            ctx.getSession().createGrid = {
                symbol: 'BTC',
                mode: CreateGridMode.Advanced,
                upperPrice: 55000,
                lowerPrice: 45000,
                levels: 10,
                totalInvestmentUSDC: 1000,
            };

            await step.enter(ctx);

            expect(ctx.reply).toHaveBeenCalledWith(
                expect.stringContaining('BTC'),
                expect.any(Object),
                'HTML',
            );
            expect(ctx.reply).toHaveBeenCalledWith(
                expect.stringContaining('advanced'),
                expect.any(Object),
                'HTML',
            );
            expect(ctx.reply).toHaveBeenCalledWith(
                expect.stringContaining('1000 USDC'),
                expect.any(Object),
                'HTML',
            );
        });

        it('should calculate order size correctly', async () => {
            const ctx = createMockContext();
            ctx.getSession().createGrid = {
                symbol: 'ETH',
                mode: CreateGridMode.Quick,
                upperPrice: 3500,
                lowerPrice: 2500,
                levels: 5,
                totalInvestmentUSDC: 500,
            };

            await step.enter(ctx);

            expect(ctx.reply).toHaveBeenCalledWith(
                expect.stringContaining('100.00 USDC per level'),
                expect.any(Object),
                'HTML',
            );
        });

        it('should exit scene if state is invalid', async () => {
            const ctx = createMockContext();
            ctx.getSession().createGrid = {
                symbol: 'BTC',
                // Missing required fields
            };

            await step.enter(ctx);

            expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Invalid state'));
            expect(ctx.leaveScene).toHaveBeenCalled();
        });
    });

    describe('handleConfirm', () => {
        it('should return confirm action', async () => {
            const ctx = createMockContext();

            const result = await step.handleConfirm(ctx);

            expect(result).toBe('confirm');
        });
    });

    describe('handleBack', () => {
        it('should clear quick mode fields', async () => {
            const ctx = createMockContext();
            ctx.getSession().createGrid = {
                mode: CreateGridMode.Quick,
                totalInvestmentUSDC: 1000,
                upperPrice: 55000,
                lowerPrice: 45000,
                levels: 10,
            };

            await step.handleBack(ctx);

            expect(ctx.getSession().createGrid?.totalInvestmentUSDC).toBeUndefined();
            expect(ctx.getSession().createGrid?.upperPrice).toBeUndefined();
            expect(ctx.getSession().createGrid?.lowerPrice).toBeUndefined();
            expect(ctx.getSession().createGrid?.levels).toBeUndefined();
        });

        it('should only clear investment for advanced mode', async () => {
            const ctx = createMockContext();
            ctx.getSession().createGrid = {
                mode: CreateGridMode.Advanced,
                totalInvestmentUSDC: 1000,
                upperPrice: 55000,
                lowerPrice: 45000,
                levels: 10,
            };

            await step.handleBack(ctx);

            expect(ctx.getSession().createGrid?.totalInvestmentUSDC).toBeUndefined();
            expect(ctx.getSession().createGrid?.upperPrice).toBe(55000);
            expect(ctx.getSession().createGrid?.lowerPrice).toBe(45000);
            expect(ctx.getSession().createGrid?.levels).toBe(10);
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
