import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdvancedInvestmentStep } from './advanced-investment.step';
import { BotContext } from '../../../types/bot-context';
import { SceneStep } from '../create-grid-scene-step';
import { TradingApiPort } from '@components/trading/api/trading-api.port';
import { SwapSide } from '@components/trading/api/dto/optimal-swap.dto';

describe('AdvancedInvestmentStep', () => {
    let step: AdvancedInvestmentStep;
    let mockTradingApi: TradingApiPort;

    beforeEach(() => {
        mockTradingApi = {
            getCurrentPrice: vi.fn().mockResolvedValue(10),
            getUserSpotState: vi.fn().mockResolvedValue({
                usdcBalance: 10000,
                spotBalances: { HYPE: 1000 },
            }),
            pairExists: vi.fn(),
            calculateCapitalDistribution: vi.fn().mockReturnValue({
                requiredUSDC: 500,
                requiredBase: 50.25,
            }),
            calculateMaxInvestment: vi.fn().mockReturnValue(5000),
            calculateOptimalSwap: vi.fn().mockReturnValue(null),
            getMinOrderNotional: vi.fn().mockReturnValue(10),
        } as unknown as TradingApiPort;

        step = new AdvancedInvestmentStep(mockTradingApi);
    });

    describe('buildView', () => {
        it('should show zero base balance warning when base token is zero', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'HYPE', levels: 10 };
            vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(10);
            vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue({
                usdcBalance: 5000,
                usdc: { available: 5000, total: 5000, hold: 0 },
                spotBalances: {},
                spotPositions: {},
            });

            const view = await step.buildView(ctx);

            expect(view.body).toContain('You have no HYPE tokens');
            expect(view.body).toContain('USDC: 5000');
        });

        it('should show locked-in-orders warning when all base is in orders', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'HYPE', levels: 10 };
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
            ctx.session.createGrid = { symbol: 'HYPE', levels: 10 };
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
            ctx.session.createGrid = { symbol: 'HYPE', levels: 10 };
            vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(10);
            vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue({
                usdcBalance: 0,
                usdc: { available: 0, total: 0, hold: 0 },
                spotBalances: { HYPE: 500 },
                spotPositions: { HYPE: { available: 500, total: 500, hold: 0 } },
            });

            const view = await step.buildView(ctx);

            expect(view.body).toContain('You have no USDC');
            expect(view.body).toContain('HYPE: 500');
        });

        it('should show balance info when both balances are non-zero', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'HYPE', levels: 10 };
            vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(10);
            vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue({
                usdcBalance: 5000,
                usdc: { available: 5000, total: 5000, hold: 0 },
                spotBalances: { HYPE: 500 },
                spotPositions: { HYPE: { available: 500, total: 500, hold: 0 } },
            });

            const view = await step.buildView(ctx);

            expect(view.body).toBeTruthy();
        });

        it('should show fallback message when symbol is missing', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { levels: 10 };

            const view = await step.buildView(ctx);

            expect(mockTradingApi.getUserSpotState).not.toHaveBeenCalled();
            expect(view.body).toBeTruthy();
        });

        it('should show fallback message when balance fetch fails', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'HYPE', levels: 10 };
            vi.mocked(mockTradingApi.getCurrentPrice).mockRejectedValue(new Error('API down'));

            const view = await step.buildView(ctx);

            expect(view.body).toBeTruthy();
        });

        it('includes Custom button in keyboard', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { levels: 10 };

            const view = await step.buildView(ctx);

            const customRow = view.keyboard.find((r) =>
                r.some((b) => b.action === 'create_grid:adv_invest:custom'),
            );
            expect(customRow).toBeDefined();
        });

        it('renders swap offer button when result.swapOffer is non-null (error path)', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'HYPE', levels: 10 };
            vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(10);
            vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue({
                usdcBalance: 5000,
                usdc: { available: 5000, total: 5000, hold: 0 },
                spotBalances: {},
                spotPositions: {},
            });
            vi.mocked(mockTradingApi.calculateOptimalSwap).mockReturnValue({
                side: SwapSide.UsdcToBase,
                amountUsdc: 100,
                expectedReceived: 10,
            });

            const view = await step.buildView(ctx);

            const hasSwapButton = view.keyboard.some((r) =>
                r.some((b) => b.action === 'create_grid:swap_offer'),
            );
            expect(hasSwapButton).toBe(true);
        });

        it('renders "Swap to maximize" button when proactive hint is shown (normal balance with imbalance)', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'HYPE', levels: 10 };
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

        it('renders "Swap to fit grid" button on error path (zero base balance)', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'HYPE', levels: 10 };
            vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(10);
            vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue({
                usdcBalance: 5000,
                usdc: { available: 5000, total: 5000, hold: 0 },
                spotBalances: {},
                spotPositions: {},
            });
            vi.mocked(mockTradingApi.calculateOptimalSwap).mockReturnValue({
                side: SwapSide.UsdcToBase,
                amountUsdc: 100,
                expectedReceived: 10,
            });

            const view = await step.buildView(ctx);

            const swapButton = view.keyboard
                .flat()
                .find((b) => b.action === 'create_grid:swap_offer');
            expect(swapButton).toBeDefined();
            expect(swapButton?.text).toContain('Swap to fit grid');
        });

        it('shows proactive hint text in body when imbalanced portfolio is present', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'HYPE', levels: 10 };
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

            expect(view.body).toContain('Max without swap: ~1,896 USDC');
        });

        it('does not show proactive hint when balances are perfectly balanced', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'HYPE', levels: 10 };
            vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(10);
            vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue({
                usdcBalance: 5000,
                usdc: { available: 5000, total: 5000, hold: 0 },
                spotBalances: { HYPE: 500 },
                spotPositions: { HYPE: { available: 500, total: 500, hold: 0 } },
            });
            vi.mocked(mockTradingApi.calculateOptimalSwap).mockReturnValue(null);

            const view = await step.buildView(ctx);

            expect(view.body).not.toContain('Max without swap');
            const hasSwapButton = view.keyboard.some((r) =>
                r.some((b) => b.action === 'create_grid:swap_offer'),
            );
            expect(hasSwapButton).toBe(false);
        });

        it('prepends swapFeedback to body when set', async () => {
            vi.useFakeTimers();
            const ctx = createMockContext();
            ctx.session.createGrid = {
                symbol: 'HYPE',
                levels: 10,
                swapFeedback: '✅ Swap complete!\n\nBought ~6.5 HYPE',
            };
            vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue({
                usdcBalance: 5000,
                usdc: { available: 5000, total: 5000, hold: 0 },
                spotBalances: { HYPE: 500 },
                spotPositions: { HYPE: { available: 500, total: 500, hold: 0 } },
            });

            const promise = step.buildView(ctx);
            await vi.runAllTimersAsync();
            const view = await promise;
            vi.useRealTimers();

            expect(view.body).toContain('Swap complete');
            expect(view.body.indexOf('Swap complete')).toBeLessThan(
                view.body.indexOf('How much to invest'),
            );
            // swapFeedback should be cleared from session after consumption
            expect(ctx.session.createGrid?.swapFeedback).toBeUndefined();
        });
    });

    describe('handleTextInput', () => {
        it('should accept valid investment amount with sufficient balance', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                levels: 10,
                symbol: 'HYPE',
                upperPrice: 11,
                lowerPrice: 9,
            };

            const result = await step.handleTextInput(ctx, '1000');

            expect(result).toEqual({ nextStep: SceneStep.StopLoss });
            expect(ctx.session.createGrid?.totalInvestmentUSDC).toBe(1000);
        });

        it('should set pendingError and return null for investment below minimum', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                levels: 10,
                symbol: 'HYPE',
                upperPrice: 11,
                lowerPrice: 9,
            };

            const result = await step.handleTextInput(ctx, '5');

            expect(result).toBeNull();
            expect(ctx.session.createGrid?.pendingError).toBeTruthy();
        });

        it('should reject when per-order amount is too small', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                levels: 20,
                symbol: 'HYPE',
                upperPrice: 11,
                lowerPrice: 9,
            };

            const result = await step.handleTextInput(ctx, '50');

            expect(result).toBeNull();
            expect(ctx.session.createGrid?.pendingError).toBeTruthy();
        });

        it('should reject when balance is insufficient', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                levels: 10,
                symbol: 'HYPE',
                upperPrice: 11,
                lowerPrice: 9,
            };

            vi.mocked(mockTradingApi.calculateCapitalDistribution).mockReturnValue({
                requiredUSDC: 15000,
                requiredBase: 50.25,
            });

            const result = await step.handleTextInput(ctx, '1000');

            expect(result).toBeNull();
            expect(ctx.session.createGrid?.pendingError).toBeTruthy();
        });

        it('should set pendingError for non-numeric input', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                levels: 10,
                symbol: 'HYPE',
                upperPrice: 11,
                lowerPrice: 9,
            };

            const result = await step.handleTextInput(ctx, 'abc');

            expect(result).toBeNull();
            expect(ctx.session.createGrid?.pendingError).toBeTruthy();
        });

        it('should return null if required state not set', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { levels: 10 };

            const result = await step.handleTextInput(ctx, '1000');

            expect(result).toBeNull();
        });

        it('should handle validateInvestment throwing an error', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                levels: 10,
                symbol: 'HYPE',
                upperPrice: 11,
                lowerPrice: 9,
            };
            vi.mocked(mockTradingApi.getUserSpotState).mockRejectedValue(
                new Error('Network error'),
            );

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
            ctx.session.createGrid = {
                levels: 10,
                symbol: 'HYPE',
                upperPrice: 11,
                lowerPrice: 9,
            };

            const result = await step.handleInvestmentPreset(ctx, '50');

            expect(result).toBeNull();
        });
    });

    describe('rollbackState', () => {
        it('clears swapOffer from session when result.swapOffer becomes null on re-render', async () => {
            const ctx = createMockContext();
            // Pre-load a stale swapOffer from a previous render
            ctx.session.createGrid = {
                symbol: 'HYPE',
                levels: 10,
                swapOffer: { side: SwapSide.UsdcToBase, amountUsdc: 2801, expectedReceived: 52 },
            };
            vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(53);
            vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue({
                usdcBalance: 6550,
                usdc: { available: 6550, total: 6550, hold: 0 },
                spotBalances: { HYPE: 17.59 },
                spotPositions: { HYPE: { available: 17.59, total: 17.59, hold: 0 } },
            });
            vi.mocked(mockTradingApi.calculateMaxInvestment).mockReturnValue(1896);
            // Swap no longer offered on re-render
            vi.mocked(mockTradingApi.calculateOptimalSwap).mockReturnValue(null);

            await step.buildView(ctx);

            expect(ctx.session.createGrid?.swapOffer).toBeUndefined();
        });

        it('deletes totalInvestmentUSDC and balanceSnapshot from session', () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                totalInvestmentUSDC: 1000,
                balanceSnapshot: { suggestedMax: 5000 },
            };

            step.rollbackState(ctx);

            expect(ctx.session.createGrid?.totalInvestmentUSDC).toBeUndefined();
            expect(ctx.session.createGrid?.balanceSnapshot).toBeUndefined();
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
