import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdvancedPreviewStep } from './advanced-preview.step';
import { BotContext } from '../../../types/bot-context';
import { CreateGridMode } from '../create-grid-mode';

describe('AdvancedPreviewStep', () => {
    let step: AdvancedPreviewStep;

    beforeEach(() => {
        step = new AdvancedPreviewStep();
    });

    describe('buildView', () => {
        it('shows "Ready to create grid?" prompt', async () => {
            const ctx = createMockContext();

            const view = await step.buildView(ctx);

            expect(view.body).toContain('Ready to create grid?');
        });

        it('shows per-order fee hint in preview body', async () => {
            const ctx = createMockContext();
            // $1000 / 10 levels = $100/order
            const view = await step.buildView(ctx);

            expect(view.body).toContain('~$100/order');
            expect(view.body).toContain('profit');
            expect(view.body).toContain('fee');
        });

        it('shows break-even warning when grid step is too tight', async () => {
            const ctx = createMockContext({
                upperPrice: 50001,
                lowerPrice: 50000,
                levels: 10,
                totalInvestmentUSDC: 1000,
            });

            const view = await step.buildView(ctx);

            expect(view.body).toContain('Break-even risk');
        });

        it('returns error body when state is invalid', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };

            const view = await step.buildView(ctx);

            expect(view.body).toContain('Invalid state');
        });

        it('includes Confirm, Back and Cancel buttons in keyboard', async () => {
            const ctx = createMockContext();

            const view = await step.buildView(ctx);

            const hasConfirm = view.keyboard.some((r) =>
                r.some((b) => b.action === 'create_grid:confirm'),
            );
            const hasBack = view.keyboard.some((r) =>
                r.some((b) => b.action === 'create_grid:back'),
            );
            expect(hasConfirm).toBe(true);
            expect(hasBack).toBe(true);
        });
    });

    describe('rollbackState', () => {
        it('does nothing when createGrid is undefined', () => {
            const ctx = createMockContext();
            ctx.session.createGrid = undefined;

            step.rollbackState(ctx);

            expect(ctx.session.createGrid).toBeUndefined();
        });

        it('clears quick mode fields', () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                mode: CreateGridMode.Quick,
                totalInvestmentUSDC: 1000,
                upperPrice: 55000,
                lowerPrice: 45000,
                levels: 10,
            };

            step.rollbackState(ctx);

            expect(ctx.session.createGrid?.totalInvestmentUSDC).toBeUndefined();
            expect(ctx.session.createGrid?.upperPrice).toBeUndefined();
        });

        it('only clears investment for advanced mode', () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                mode: CreateGridMode.Advanced,
                totalInvestmentUSDC: 1000,
                upperPrice: 55000,
                lowerPrice: 45000,
                levels: 10,
            };

            step.rollbackState(ctx);

            expect(ctx.session.createGrid?.totalInvestmentUSDC).toBeUndefined();
            expect(ctx.session.createGrid?.upperPrice).toBe(55000);
        });
    });

    function createMockContext(
        overrides: Partial<{
            upperPrice: number;
            lowerPrice: number;
            levels: number;
            totalInvestmentUSDC: number;
        }> = {},
    ): BotContext {
        const session = {
            createGrid: {
                symbol: 'BTC',
                mode: CreateGridMode.Advanced,
                upperPrice: 55000,
                lowerPrice: 45000,
                levels: 10,
                totalInvestmentUSDC: 1000,
                ...overrides,
            },
        };
        return {
            session,
            scene: { leave: vi.fn() },
        } as unknown as BotContext;
    }
});
