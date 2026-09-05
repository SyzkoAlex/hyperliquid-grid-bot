import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiStartStep } from './ai-start.step';
import { TradingApiPort } from '@components/trading/api/trading-api.port';
import { PredictionApiPort } from '@components/prediction/api/prediction-api.port';
import { BestGridDto } from '@components/prediction/api/dto/best-grid.dto';
import { PredictionWarning } from '@components/prediction/api/dto/prediction-warning';
import { BotContext } from '../../../types/bot-context';
import { SceneStep } from '../create-grid-scene-step';
import { AiSuggestionSource } from '../ai-suggestion-source';

function makeBestGrid(overrides: Partial<BestGridDto> = {}): BestGridDto {
    return {
        pair: 'HYPE/USDC',
        baseAsset: 'HYPE',
        conservativePnlUsdc: 12.5,
        recommendedConfig: { lower: 40, upper: 60, nLevels: 15 },
        warnings: [PredictionWarning.LowLiquidity],
        periodDays: 7,
        ...overrides,
    };
}

describe('AiStartStep', () => {
    let step: AiStartStep;
    let mockTradingApi: TradingApiPort;
    let mockPredictionApi: PredictionApiPort;

    beforeEach(() => {
        mockTradingApi = {
            getCurrentPrice: vi.fn().mockResolvedValue(50),
            getUserSpotState: vi.fn().mockResolvedValue({
                usdcBalance: 10000,
                usdc: { available: 10000, total: 10000, hold: 0 },
                spotBalances: { HYPE: 100 },
                spotPositions: { HYPE: { available: 100, total: 100, hold: 0 } },
            }),
            calculateCapitalDistribution: vi.fn().mockReturnValue({
                requiredUSDC: 500,
                requiredBase: 10,
            }),
            calculateMaxInvestment: vi.fn().mockReturnValue(5000),
            calculateOptimalSwap: vi.fn().mockReturnValue(null),
            getMinOrderNotional: vi.fn().mockReturnValue(10),
        } as unknown as TradingApiPort;

        mockPredictionApi = {
            isAvailable: vi.fn().mockReturnValue(true),
            getBestGrid: vi.fn().mockResolvedValue(makeBestGrid()),
        } as unknown as PredictionApiPort;

        step = new AiStartStep(mockTradingApi, mockPredictionApi);
    });

    describe('buildView — suggestion applied', () => {
        it('stores suggested range in session and caches aiSuggestion', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'HYPE' };

            await step.buildView(ctx);

            expect(ctx.session.createGrid?.upperPrice).toBe(60);
            expect(ctx.session.createGrid?.lowerPrice).toBe(40);
            expect(ctx.session.createGrid?.currentPrice).toBe(50);
            expect(ctx.session.createGrid?.aiSuggestion).toEqual({
                source: AiSuggestionSource.Prediction,
                lowerPrice: 40,
                upperPrice: 60,
                orderCount: 15,
                conservativePnlUsdc: 12.5,
                warnings: [PredictionWarning.LowLiquidity],
                periodDays: 7,
            });
        });

        it('renders the AI suggestion block and warning line in the body', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'HYPE' };

            const view = await step.buildView(ctx);

            expect(view.body).toContain('AI suggestion');
            expect(view.body).toContain('15 orders');
            expect(view.body).toContain('Low trading volume');
            expect(view.body).not.toContain('AI suggestion is unavailable');
        });

        it('uses ai_invest preset actions in the keyboard', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'HYPE' };

            const view = await step.buildView(ctx);

            const actions = view.keyboard.flat().map((b) => b.action);
            expect(actions).toContain('create_grid:ai_invest:25');
            expect(actions).toContain('create_grid:ai_invest:max');
            expect(actions).toContain('create_grid:ai_invest:custom');
            expect(actions.some((a) => a?.startsWith('create_grid:quick_invest:'))).toBe(false);
        });

        it('clamps n_levels below MIN_ORDERS up to MIN_ORDERS', async () => {
            vi.mocked(mockPredictionApi.getBestGrid).mockResolvedValue(
                makeBestGrid({ recommendedConfig: { lower: 40, upper: 60, nLevels: 3 } }),
            );
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'HYPE' };

            await step.buildView(ctx);

            expect(ctx.session.createGrid?.aiSuggestion?.orderCount).toBe(5);
        });

        it('clamps n_levels above MAX_ORDERS down to MAX_ORDERS', async () => {
            vi.mocked(mockPredictionApi.getBestGrid).mockResolvedValue(
                makeBestGrid({ recommendedConfig: { lower: 40, upper: 60, nLevels: 150 } }),
            );
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'HYPE' };

            await step.buildView(ctx);

            expect(ctx.session.createGrid?.aiSuggestion?.orderCount).toBe(100);
        });

        it('does not re-fetch when aiSuggestion is already cached', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                symbol: 'HYPE',
                aiSuggestion: {
                    source: AiSuggestionSource.Prediction,
                    lowerPrice: 42,
                    upperPrice: 58,
                    orderCount: 8,
                },
            };

            await step.buildView(ctx);

            expect(mockPredictionApi.getBestGrid).not.toHaveBeenCalled();
            expect(ctx.session.createGrid?.upperPrice).toBe(58);
            expect(ctx.session.createGrid?.lowerPrice).toBe(42);
        });
    });

    describe('buildView — fallback', () => {
        it('falls back to ±20% and DEFAULT_ORDERS when the fetch throws', async () => {
            vi.mocked(mockPredictionApi.getBestGrid).mockRejectedValue(new Error('timeout'));
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'HYPE' };

            const view = await step.buildView(ctx);

            expect(ctx.session.createGrid?.aiSuggestion).toEqual({
                source: AiSuggestionSource.Fallback,
                lowerPrice: 40,
                upperPrice: 60,
                orderCount: 10,
            });
            expect(view.body).toContain('AI suggestion is unavailable');
        });

        it('falls back when getBestGrid returns null (unknown ticker)', async () => {
            vi.mocked(mockPredictionApi.getBestGrid).mockResolvedValue(null);
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'HYPE' };

            const view = await step.buildView(ctx);

            expect(ctx.session.createGrid?.aiSuggestion?.source).toBe(AiSuggestionSource.Fallback);
            expect(ctx.session.createGrid?.aiSuggestion?.orderCount).toBe(10);
            expect(view.body).toContain('AI suggestion is unavailable');
        });

        it('falls back when recommendedConfig is null', async () => {
            vi.mocked(mockPredictionApi.getBestGrid).mockResolvedValue(
                makeBestGrid({ recommendedConfig: null }),
            );
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'HYPE' };

            const view = await step.buildView(ctx);

            expect(ctx.session.createGrid?.aiSuggestion?.source).toBe(AiSuggestionSource.Fallback);
            expect(view.body).toContain('AI suggestion is unavailable');
        });

        it('keeps the suggestion header (not the fallback notice) when balance work fails after a resolved suggestion', async () => {
            // resolveSuggestion succeeds (Prediction), then getCurrentPrice throws:
            // the suggested order count stays cached and will be applied on text
            // input, so the body must not claim ±20% / 10 orders.
            vi.mocked(mockTradingApi.getCurrentPrice).mockRejectedValue(new Error('API down'));
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'HYPE' };

            const view = await step.buildView(ctx);

            expect(ctx.session.createGrid?.aiSuggestion?.source).toBe(
                AiSuggestionSource.Prediction,
            );
            expect(view.body).toContain('AI suggestion');
            expect(view.body).toContain('15 orders');
            expect(view.body).not.toContain('AI suggestion is unavailable');
        });

        it('shows the fallback notice when balance work fails and the cached suggestion is itself a fallback', async () => {
            vi.mocked(mockPredictionApi.getBestGrid).mockRejectedValue(new Error('timeout'));
            const ctx = createMockContext();
            ctx.session.createGrid = {
                symbol: 'HYPE',
                aiSuggestion: {
                    source: AiSuggestionSource.Fallback,
                    lowerPrice: 40,
                    upperPrice: 60,
                    orderCount: 10,
                },
            };
            vi.mocked(mockTradingApi.getCurrentPrice).mockRejectedValue(new Error('API down'));

            const view = await step.buildView(ctx);

            expect(view.body).toContain('AI suggestion is unavailable');
        });

        it('shows fallback prompt without fetching when symbol is missing', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {};

            const view = await step.buildView(ctx);

            expect(mockPredictionApi.getBestGrid).not.toHaveBeenCalled();
            expect(view.body).toBeTruthy();
        });
    });

    describe('handleTextInput', () => {
        it('validates with the suggested orderCount and persists it', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                symbol: 'HYPE',
                upperPrice: 60,
                lowerPrice: 40,
                aiSuggestion: {
                    source: AiSuggestionSource.Prediction,
                    lowerPrice: 40,
                    upperPrice: 60,
                    orderCount: 15,
                },
            };

            const result = await step.handleTextInput(ctx, '1000');

            expect(result).toEqual({ nextStep: SceneStep.Preview });
            expect(ctx.session.createGrid?.totalInvestmentUSDC).toBe(1000);
            expect(ctx.session.createGrid?.orderCount).toBe(15);
            expect(mockTradingApi.calculateCapitalDistribution).toHaveBeenCalledWith(
                expect.objectContaining({ orderCount: 15 }),
            );
        });

        it('falls back to DEFAULT_ORDERS when aiSuggestion is missing', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'HYPE', upperPrice: 60, lowerPrice: 40 };

            const result = await step.handleTextInput(ctx, '1000');

            expect(result).toEqual({ nextStep: SceneStep.Preview });
            expect(ctx.session.createGrid?.orderCount).toBe(10);
        });

        it('sets pendingError and returns null for investment below minimum', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'HYPE' };

            const result = await step.handleTextInput(ctx, '5');

            expect(result).toBeNull();
            expect(ctx.session.createGrid?.pendingError).toBeTruthy();
        });

        it('sets pendingError on API error', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'HYPE' };
            vi.mocked(mockTradingApi.getCurrentPrice).mockRejectedValue(new Error('API error'));

            const result = await step.handleTextInput(ctx, '1000');

            expect(result).toBeNull();
            expect(ctx.session.createGrid?.pendingError).toBeTruthy();
        });

        it('returns null if no symbol in session', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {};

            const result = await step.handleTextInput(ctx, '1000');

            expect(result).toBeNull();
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

        it('applies a percentage of suggestedMax and routes to Preview', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                symbol: 'HYPE',
                upperPrice: 60,
                lowerPrice: 40,
                balanceSnapshot: { suggestedMax: 4000 },
                aiSuggestion: {
                    source: AiSuggestionSource.Prediction,
                    lowerPrice: 40,
                    upperPrice: 60,
                    orderCount: 15,
                },
            };

            const result = await step.handleInvestmentPreset(ctx, '50');

            expect(result).toEqual({ nextStep: SceneStep.Preview });
            expect(ctx.session.createGrid?.totalInvestmentUSDC).toBe(2000);
            expect(ctx.session.createGrid?.orderCount).toBe(15);
        });
    });

    describe('rollbackState', () => {
        it('clears all AI-step fields including aiSuggestion', () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                totalInvestmentUSDC: 1000,
                upperPrice: 60,
                lowerPrice: 40,
                orderCount: 15,
                balanceSnapshot: { suggestedMax: 5000 },
                swapFeedback: 'done',
                aiSuggestion: {
                    source: AiSuggestionSource.Prediction,
                    lowerPrice: 40,
                    upperPrice: 60,
                    orderCount: 15,
                },
            };

            step.rollbackState(ctx);

            expect(ctx.session.createGrid?.totalInvestmentUSDC).toBeUndefined();
            expect(ctx.session.createGrid?.upperPrice).toBeUndefined();
            expect(ctx.session.createGrid?.lowerPrice).toBeUndefined();
            expect(ctx.session.createGrid?.orderCount).toBeUndefined();
            expect(ctx.session.createGrid?.balanceSnapshot).toBeUndefined();
            expect(ctx.session.createGrid?.swapOffer).toBeUndefined();
            expect(ctx.session.createGrid?.swapOfferPrice).toBeUndefined();
            expect(ctx.session.createGrid?.swapFeedback).toBeUndefined();
            expect(ctx.session.createGrid?.aiSuggestion).toBeUndefined();
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
