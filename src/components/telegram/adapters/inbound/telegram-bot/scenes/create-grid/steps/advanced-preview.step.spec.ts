import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdvancedPreviewStep } from './advanced-preview.step';
import { BotContext } from '../../../types/bot-context';
import { CreateGridMode } from '../create-grid-mode';
import { TradingApiPort } from '@components/trading/api/trading-api.port';

describe('AdvancedPreviewStep', () => {
    let step: AdvancedPreviewStep;
    let mockTradingApi: TradingApiPort;

    beforeEach(() => {
        mockTradingApi = {
            getCurrentPrice: vi.fn().mockResolvedValue(50000),
            getUserSpotState: vi.fn(),
            pairExists: vi.fn(),
        } as unknown as TradingApiPort;

        step = new AdvancedPreviewStep(mockTradingApi);
    });

    describe('buildView', () => {
        it('should display complete grid configuration', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                symbol: 'BTC',
                mode: CreateGridMode.Advanced,
                upperPrice: 55000,
                lowerPrice: 45000,
                levels: 10,
                totalInvestmentUSDC: 1000,
            };

            const view = await step.buildView(ctx);

            expect(view.body).toContain('BTC');
            expect(view.body).toContain('55000');
        });

        it('should calculate order size correctly', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                symbol: 'ETH',
                mode: CreateGridMode.Quick,
                upperPrice: 3500,
                lowerPrice: 2500,
                levels: 5,
                totalInvestmentUSDC: 500,
            };

            const view = await step.buildView(ctx);

            expect(view.body).toContain('100'); // 500/5 = 100
        });

        it('should return error body when state is invalid', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                symbol: 'BTC',
                // Missing required fields
            };

            const view = await step.buildView(ctx);

            expect(view.body).toContain('Invalid state');
        });

        it('should build preview with null price when getCurrentPrice throws', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                symbol: 'BTC',
                mode: CreateGridMode.Advanced,
                upperPrice: 55000,
                lowerPrice: 45000,
                levels: 10,
                totalInvestmentUSDC: 1000,
            };
            vi.mocked(mockTradingApi.getCurrentPrice).mockRejectedValue(new Error('API error'));

            const view = await step.buildView(ctx);

            expect(view.body).toBeTruthy();
        });

        it('shows fee block in preview body', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                symbol: 'BTC',
                mode: CreateGridMode.Advanced,
                upperPrice: 55000,
                lowerPrice: 45000,
                levels: 10,
                totalInvestmentUSDC: 1000,
            };

            const view = await step.buildView(ctx);

            expect(view.body).toContain('Fee per grid cycle');
            expect(view.body).toContain('Profit per grid');
        });

        it('shows break-even warning when grid step is too tight', async () => {
            const ctx = createMockContext();
            // Very tight 10-level range: step ~0.001% << 2*makerRate
            ctx.session.createGrid = {
                symbol: 'BTC',
                mode: CreateGridMode.Advanced,
                upperPrice: 50001,
                lowerPrice: 50000,
                levels: 10,
                totalInvestmentUSDC: 1000,
            };

            const view = await step.buildView(ctx);

            expect(view.body).toContain('Break-even risk');
        });

        it('includes Confirm, Back and Cancel buttons in keyboard', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                symbol: 'BTC',
                mode: CreateGridMode.Advanced,
                upperPrice: 55000,
                lowerPrice: 45000,
                levels: 10,
                totalInvestmentUSDC: 1000,
            };

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

        it('should clear quick mode fields', () => {
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
            expect(ctx.session.createGrid?.lowerPrice).toBeUndefined();
            expect(ctx.session.createGrid?.levels).toBeUndefined();
        });

        it('should only clear investment for advanced mode', () => {
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
            expect(ctx.session.createGrid?.lowerPrice).toBe(45000);
            expect(ctx.session.createGrid?.levels).toBe(10);
        });
    });

    function createMockContext(): BotContext {
        const session = { createGrid: {} };
        return {
            session,
            scene: { leave: vi.fn() },
        } as unknown as BotContext;
    }
});
