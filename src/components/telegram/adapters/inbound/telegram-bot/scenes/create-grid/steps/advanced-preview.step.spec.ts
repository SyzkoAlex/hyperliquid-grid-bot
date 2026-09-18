import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdvancedPreviewStep } from './advanced-preview.step';
import { BotContext } from '../../../types/bot-context';
import { CreateGridMode } from '../create-grid-mode';
import { CREATE_GRID_ACTIONS } from '../create-grid-actions';
import { AiSuggestionSource } from '../ai-suggestion-source';

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
            // $1000 / 10 orders = $100/order
            const view = await step.buildView(ctx);

            expect(view.body).toContain('~$100/order');
            expect(view.body).toContain('profit');
            expect(view.body).toContain('fee');
        });

        it('shows break-even warning when grid step is too tight', async () => {
            const ctx = createMockContext({
                upperPrice: 50001,
                lowerPrice: 50000,
                orderCount: 10,
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
            expect(view.keyboard.flat().some((b) => b.action === CREATE_GRID_ACTIONS.BACK)).toBe(
                true,
            );
        });

        it('includes Confirm, Back and Cancel buttons in keyboard', async () => {
            const ctx = createMockContext();

            const view = await step.buildView(ctx);

            const flat = view.keyboard.flat();
            expect(flat.some((b) => b.action === CREATE_GRID_ACTIONS.CONFIRM)).toBe(true);
            expect(flat.some((b) => b.action === CREATE_GRID_ACTIONS.BACK)).toBe(true);
            expect(flat.some((b) => b.action === CREATE_GRID_ACTIONS.CANCEL)).toBe(true);
        });

        it('shows the capacity line when balanceSnapshot is present', async () => {
            const ctx = createMockContext({ totalInvestmentUSDC: 326 }, { suggestedMax: 1304 });

            const view = await step.buildView(ctx);

            expect(view.body).toContain('326.00');
            expect(view.body).toContain('1,304.00');
            expect(view.body).toContain('25%');
        });

        it('renders without the capacity line when balanceSnapshot is absent', async () => {
            const ctx = createMockContext();

            const view = await step.buildView(ctx);

            expect(view.body).not.toContain('max for this grid');
            expect(view.body).not.toContain('NaN');
            expect(view.body).not.toContain('undefined');
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
                orderCount: 10,
            };

            step.rollbackState(ctx);

            expect(ctx.session.createGrid?.totalInvestmentUSDC).toBeUndefined();
            expect(ctx.session.createGrid?.upperPrice).toBeUndefined();
            expect(ctx.session.createGrid?.lowerPrice).toBeUndefined();
            expect(ctx.session.createGrid?.orderCount).toBeUndefined();
        });

        it('clears ai mode fields but keeps aiSuggestion for a cheap re-render', () => {
            const ctx = createMockContext();
            const aiSuggestion = {
                source: AiSuggestionSource.Prediction,
                lowerPrice: 40,
                upperPrice: 60,
                orderCount: 15,
            };
            ctx.session.createGrid = {
                mode: CreateGridMode.Ai,
                totalInvestmentUSDC: 1000,
                upperPrice: 60,
                lowerPrice: 40,
                orderCount: 15,
                aiSuggestion,
            };

            step.rollbackState(ctx);

            expect(ctx.session.createGrid?.totalInvestmentUSDC).toBeUndefined();
            expect(ctx.session.createGrid?.upperPrice).toBeUndefined();
            expect(ctx.session.createGrid?.lowerPrice).toBeUndefined();
            expect(ctx.session.createGrid?.orderCount).toBeUndefined();
            expect(ctx.session.createGrid?.aiSuggestion).toEqual(aiSuggestion);
        });

        it('only clears investment for advanced mode', () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                mode: CreateGridMode.Advanced,
                totalInvestmentUSDC: 1000,
                upperPrice: 55000,
                lowerPrice: 45000,
                orderCount: 10,
            };

            step.rollbackState(ctx);

            expect(ctx.session.createGrid?.totalInvestmentUSDC).toBeUndefined();
            expect(ctx.session.createGrid?.upperPrice).toBe(55000);
            expect(ctx.session.createGrid?.lowerPrice).toBe(45000);
            expect(ctx.session.createGrid?.orderCount).toBe(10);
        });
    });

    function createMockContext(
        overrides: Partial<{
            upperPrice: number;
            lowerPrice: number;
            orderCount: number;
            totalInvestmentUSDC: number;
        }> = {},
        balanceSnapshot?: { suggestedMax: number },
    ): BotContext {
        const session = {
            createGrid: {
                symbol: 'BTC',
                mode: CreateGridMode.Advanced,
                upperPrice: 55000,
                lowerPrice: 45000,
                orderCount: 10,
                totalInvestmentUSDC: 1000,
                balanceSnapshot,
                ...overrides,
            },
        };
        return {
            session,
            scene: { leave: vi.fn() },
        } as unknown as BotContext;
    }
});
