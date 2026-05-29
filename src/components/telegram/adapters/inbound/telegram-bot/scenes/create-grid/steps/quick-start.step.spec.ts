import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuickStartStep } from './quick-start.step';
import { TradingApiPort } from '@components/trading/api/trading-api.port';
import { BotContext } from '../../../types/bot-context';
import { SceneStep } from '../create-grid-scene-step';
import { SwapSide } from '@components/trading/api/dto/optimal-swap.dto';

describe('QuickStartStep', () => {
    let step: QuickStartStep;
    let mockTradingApi: TradingApiPort;

    beforeEach(() => {
        mockTradingApi = {
            getCurrentPrice: vi.fn(),
            getUserSpotState: vi.fn(),
            pairExists: vi.fn(),
            calculateCapitalDistribution: vi.fn().mockReturnValue({
                requiredUSDC: 500,
                requiredBase: 0.01005,
            }),
            calculateMaxInvestment: vi.fn().mockReturnValue(5000),
            calculateOptimalSwap: vi.fn().mockReturnValue(null),
            getMinOrderNotional: vi.fn().mockReturnValue(10),
        } as unknown as TradingApiPort;

        step = new QuickStartStep(mockTradingApi);
    });

    describe('buildView', () => {
        it('should show zero base balance warning when base token is zero', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };
            vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(50000);
            vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue({
                usdcBalance: 1000,
                usdc: { available: 1000, total: 1000, hold: 0 },
                spotBalances: {},
                spotPositions: {},
            });

            const view = await step.buildView(ctx);

            expect(view.body).toContain('You have no BTC tokens');
            expect(view.body).toContain('USDC: 1000');
        });

        it('should show locked-in-orders warning when all base is in orders', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'HYPE' };
            vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(74);
            vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue({
                usdcBalance: 5697,
                usdc: { available: 5697, total: 5697, hold: 0 },
                spotBalances: { HYPE: 0 },
                spotPositions: { HYPE: { available: 0, total: 22.48, hold: 22.48 } },
            });
            vi.mocked(mockTradingApi.calculateMaxInvestment).mockReturnValue(0);

            const view = await step.buildView(ctx);

            expect(view.body).toContain('locked in existing orders');
            expect(view.body).toContain('HYPE');
        });

        it('should show locked-in-orders warning when partial base is locked and max-investment is too low', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'HYPE' };
            vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(74);
            vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue({
                usdcBalance: 5697,
                usdc: { available: 5697, total: 5697, hold: 0 },
                spotBalances: { HYPE: 0.001 },
                spotPositions: { HYPE: { available: 0.001, total: 22.481, hold: 22.48 } },
            });
            vi.mocked(mockTradingApi.calculateMaxInvestment).mockReturnValue(0);

            const view = await step.buildView(ctx);

            expect(view.body).toContain('locked in existing orders');
            expect(view.body).not.toContain('Insufficient balance');
        });

        it('should show zero USDC balance warning when USDC is zero', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };
            vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(50000);
            vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue({
                usdcBalance: 0,
                usdc: { available: 0, total: 0, hold: 0 },
                spotBalances: { BTC: 0.5 },
                spotPositions: { BTC: { available: 0.5, total: 0.5, hold: 0 } },
            });

            const view = await step.buildView(ctx);

            expect(view.body).toContain('You have no USDC');
            expect(view.body).toContain('BTC: 0.5');
        });

        it('should show balance info when both balances are non-zero', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };
            vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(50000);
            vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue({
                usdcBalance: 5000,
                usdc: { available: 5000, total: 5000, hold: 0 },
                spotBalances: { BTC: 0.1 },
                spotPositions: { BTC: { available: 0.1, total: 0.1, hold: 0 } },
            });

            const view = await step.buildView(ctx);

            expect(view.body).toBeTruthy();
        });

        it('should show fallback message when symbol is missing', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {};

            const view = await step.buildView(ctx);

            expect(mockTradingApi.getUserSpotState).not.toHaveBeenCalled();
            expect(view.body).toBeTruthy();
        });

        it('should show fallback message when balance fetch fails', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };
            vi.mocked(mockTradingApi.getCurrentPrice).mockRejectedValue(new Error('API down'));

            const view = await step.buildView(ctx);

            expect(view.body).toBeTruthy();
        });

        it('includes Custom button in keyboard', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };
            vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(50000);
            vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue({
                usdcBalance: 5000,
                usdc: { available: 5000, total: 5000, hold: 0 },
                spotBalances: { BTC: 0.1 },
                spotPositions: { BTC: { available: 0.1, total: 0.1, hold: 0 } },
            });

            const view = await step.buildView(ctx);

            const customRow = view.keyboard.find((r) =>
                r.some((b) => b.action === 'create_grid:quick_invest:custom'),
            );
            expect(customRow).toBeDefined();
        });

        it('prepends swapFeedback when set and clears it from session', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                symbol: 'HYPE',
                swapFeedback: '✅ Swap complete!\n\nBought ~10.5 HYPE',
            };
            vi.mocked(mockTradingApi.getCurrentPrice).mockRejectedValue(new Error('API down'));

            const view = await step.buildView(ctx);

            expect(view.body).toContain('✅ Swap complete!');
            expect(view.body).toContain('Bought ~10.5 HYPE');
            expect(ctx.session.createGrid?.swapFeedback).toBeUndefined();
        });

        it('does not prepend swapFeedback when not set', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'HYPE' };
            vi.mocked(mockTradingApi.getCurrentPrice).mockRejectedValue(new Error('API down'));

            const view = await step.buildView(ctx);

            expect(view.body).not.toContain('Swap complete');
        });

        it('renders Swap to maximize button when proactive hint is shown', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'HYPE' };
            vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(53);
            vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue({
                usdcBalance: 6550,
                usdc: { available: 6550, total: 6550, hold: 0 },
                spotBalances: { HYPE: 17.59 },
                spotPositions: { HYPE: { available: 17.59, total: 17.59, hold: 0 } },
            });
            vi.mocked(mockTradingApi.calculateMaxInvestment).mockReturnValue(1896);
            vi.mocked(mockTradingApi.calculateOptimalSwap).mockReturnValue({
                side: SwapSide.UsdcToBase,
                amountUsdc: 2801,
                expectedReceived: 52,
            });

            const view = await step.buildView(ctx);

            const swapButton = view.keyboard
                .flat()
                .find((b) => b.action === 'create_grid:swap_offer');
            expect(swapButton).toBeDefined();
            expect(swapButton?.text).toContain('Swap to maximize');
        });
    });

    describe('handleTextInput', () => {
        it('should calculate grid params with ±20% range and sufficient balance', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };
            vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(50000);
            vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue({
                usdcBalance: 10000,
                usdc: { available: 10000, total: 10000, hold: 0 },
                spotBalances: { BTC: 1 },
                spotPositions: { BTC: { available: 1, total: 1, hold: 0 } },
            });

            const result = await step.handleTextInput(ctx, '1000');

            expect(result).toEqual({ nextStep: SceneStep.Preview });
            expect(ctx.session.createGrid?.totalInvestmentUSDC).toBe(1000);
            expect(ctx.session.createGrid?.upperPrice).toBe(60000);
            expect(ctx.session.createGrid?.lowerPrice).toBe(40000);
            expect(ctx.session.createGrid?.levels).toBe(10);
        });

        it('should set pendingError and return null for investment below minimum', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };

            const result = await step.handleTextInput(ctx, '5');

            expect(result).toBeNull();
            expect(ctx.session.createGrid?.pendingError).toBeTruthy();
        });

        it('should set pendingError for invalid number', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };

            const result = await step.handleTextInput(ctx, 'invalid');

            expect(result).toBeNull();
            expect(ctx.session.createGrid?.pendingError).toBeTruthy();
        });

        it('should set pendingError on API error', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };
            vi.mocked(mockTradingApi.getCurrentPrice).mockRejectedValue(new Error('API error'));

            const result = await step.handleTextInput(ctx, '1000');

            expect(result).toBeNull();
            expect(ctx.session.createGrid?.pendingError).toBeTruthy();
        });

        it('should return null if no symbol in session', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {};

            const result = await step.handleTextInput(ctx, '1000');

            expect(result).toBeNull();
        });

        it('should reject with insufficient USDC balance', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };
            vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(50000);
            vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue({
                usdcBalance: 100,
                usdc: { available: 100, total: 100, hold: 0 },
                spotBalances: { BTC: 1 },
                spotPositions: { BTC: { available: 1, total: 1, hold: 0 } },
            });
            vi.mocked(mockTradingApi.calculateCapitalDistribution).mockReturnValue({
                requiredUSDC: 500,
                requiredBase: 0.01005,
            });

            const result = await step.handleTextInput(ctx, '1000');

            expect(result).toBeNull();
            expect(ctx.session.createGrid?.pendingError).toBeTruthy();
        });
    });

    describe('handleInvestmentPreset', () => {
        it('sets pendingError and returns null when key is "custom"', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {};

            const result = await step.handleInvestmentPreset(ctx, 'custom');

            expect(result).toBeNull();
            expect(ctx.session.createGrid?.pendingError).toBeTruthy();
        });

        it('returns null when balanceSnapshot is missing', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {};

            const result = await step.handleInvestmentPreset(ctx, '50');

            expect(result).toBeNull();
        });
    });

    describe('rollbackState', () => {
        it('clears all quick-start fields', () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                totalInvestmentUSDC: 1000,
                upperPrice: 60000,
                lowerPrice: 40000,
                levels: 10,
                balanceSnapshot: { suggestedMax: 5000 },
            };

            step.rollbackState(ctx);

            expect(ctx.session.createGrid?.totalInvestmentUSDC).toBeUndefined();
            expect(ctx.session.createGrid?.upperPrice).toBeUndefined();
            expect(ctx.session.createGrid?.lowerPrice).toBeUndefined();
            expect(ctx.session.createGrid?.levels).toBeUndefined();
            expect(ctx.session.createGrid?.balanceSnapshot).toBeUndefined();
        });

        it('clears session.createGrid.swapOffer on rollback', () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                swapOffer: { side: SwapSide.UsdcToBase, amountUsdc: 100, expectedReceived: 10 },
                balanceSnapshot: { suggestedMax: 5000 },
            };

            step.rollbackState(ctx);

            expect(ctx.session.createGrid?.swapOffer).toBeUndefined();
        });

        it('clears swapFeedback on rollback', () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                swapFeedback: '✅ Swap complete!\n\nBought ~10 HYPE',
            };

            step.rollbackState(ctx);

            expect(ctx.session.createGrid?.swapFeedback).toBeUndefined();
        });

        it('does nothing when createGrid is undefined', () => {
            const ctx = createMockContext();
            ctx.session.createGrid = undefined;

            expect(() => step.rollbackState(ctx)).not.toThrow();
        });
    });

    function createMockContext(): BotContext {
        const session = { createGrid: {} };
        return {
            session,
            scene: { leave: vi.fn() },
            user: { accountAddress: '0x123' },
        } as unknown as BotContext;
    }
});
