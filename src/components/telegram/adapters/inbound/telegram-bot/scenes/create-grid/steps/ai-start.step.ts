import { Inject, Injectable } from '@nestjs/common';
import { BotContext } from '../../../types/bot-context';
import { buildAiInvestmentPreset } from '../create-grid-actions';
import { TRADING_API_PORT, TradingApiPort } from '@components/trading/api/trading-api.port';
import {
    PREDICTION_API_PORT,
    PredictionApiPort,
} from '@components/prediction/api/prediction-api.port';
import { logger } from '@/infra/logger/logger';
import { WizardStep } from '../wizard/wizard-step';
import { SceneStep } from '../create-grid-scene-step';
import { StepResult } from '../wizard/step-result';
import { StepView } from '../wizard/step-view';
import { WIZARD_CONFIG } from '@components/telegram/core/domain/models/constants/wizard-config';
import { AiStartMessages } from '@components/telegram/core/domain/models/messages/wizard/ai-start.messages';
import { ValidationTexts } from '@components/telegram/core/domain/models/messages/wizard/validation.texts';
import { buildInvestmentView } from '../helpers/investment-view-builder';
import { validateInvestment } from '../helpers/investment-validator';
import { buildInvestmentPresetKeyboard } from '../helpers/investment-preset-keyboard';
import { handleInvestmentPresetSelection } from '../helpers/investment-preset-selection';
import { awaitSwapBalanceSettle, persistSwapOffer } from '../helpers/swap-session.helpers';
import { AiSuggestionState } from '../ai-suggestion-state';
import { AiSuggestionSource } from '../ai-suggestion-source';

@Injectable()
export class AiStartStep implements WizardStep {
    readonly id = SceneStep.Ai;
    private readonly logger = logger.child({ context: AiStartStep.name });

    constructor(
        @Inject(TRADING_API_PORT) private readonly tradingApi: TradingApiPort,
        @Inject(PREDICTION_API_PORT) private readonly predictionApi: PredictionApiPort,
    ) {}

    async buildView(ctx: BotContext): Promise<StepView> {
        const session = ctx.session;
        const symbol = session.createGrid?.symbol;
        const accountAddress = ctx.user?.accountAddress;

        // Consume and clear the post-swap success banner set by SwapStep
        const swapFeedback = session.createGrid?.swapFeedback;
        if (swapFeedback && session.createGrid) {
            delete session.createGrid.swapFeedback;
        }

        let suggestedMax: number | null = null;
        let body = AiStartMessages.prompt(AiStartMessages.fallbackNotice());
        let hasSwapOffer = false;

        if (symbol && accountAddress) {
            try {
                let suggestion = session.createGrid?.aiSuggestion;
                if (!suggestion) {
                    suggestion = await this.resolveSuggestion(symbol);
                    if (session.createGrid) {
                        session.createGrid.aiSuggestion = suggestion;
                    }
                }
                const header = this.buildHeader(symbol, suggestion);
                const { lowerPrice, upperPrice, orderCount } = suggestion;

                // After a swap, the exchange balance endpoint may lag behind the
                // fill settlement — wait briefly so preset buttons reflect the
                // post-swap state.
                await awaitSwapBalanceSettle(swapFeedback);

                const currentPrice = await this.tradingApi.getCurrentPrice(symbol);
                if (session.createGrid) {
                    session.createGrid.currentPrice = currentPrice;
                    session.createGrid.upperPrice = upperPrice;
                    session.createGrid.lowerPrice = lowerPrice;
                }

                const result = await buildInvestmentView(
                    this.tradingApi,
                    accountAddress,
                    symbol,
                    orderCount,
                    lowerPrice,
                    upperPrice,
                    {
                        fallback: () => AiStartMessages.prompt(header),
                        withBalance: (info) =>
                            AiStartMessages.prompt(header, {
                                symbol: info.symbol,
                                usdcBalance: info.usdcBalance,
                                baseBalance: info.baseBalance,
                                baseInUsdc: info.baseInUsdc,
                                totalBalance: info.totalBalance,
                                currentPrice: info.currentPrice,
                                suggestedMax: info.suggestedMax,
                                lowerPrice: info.lowerPrice,
                                upperPrice: info.upperPrice,
                                orderCount,
                            }),
                    },
                );

                body = result.body;
                suggestedMax = result.suggestedMax;

                if (suggestedMax !== null && session.createGrid) {
                    session.createGrid.balanceSnapshot = { suggestedMax };
                }

                if (session.createGrid) {
                    hasSwapOffer = persistSwapOffer(
                        session.createGrid,
                        result.swapOffer,
                        result.swapOfferPrice,
                    );
                }
            } catch (error) {
                this.logger.warn({ error }, 'Failed to fetch balance in AI start step');
                // Keep the body consistent with the cached suggestion: a later
                // text input applies the suggested order count/range, so the
                // pre-initialized fallback notice (±20% / 10 orders) would be
                // misleading when a suggestion was already resolved.
                const cachedSuggestion = session.createGrid?.aiSuggestion;
                if (cachedSuggestion) {
                    body = AiStartMessages.prompt(this.buildHeader(symbol, cachedSuggestion));
                }
            }
        }

        if (swapFeedback) {
            body = `${swapFeedback}\n\n${body}`;
        }

        return {
            body,
            keyboard: buildInvestmentPresetKeyboard(
                suggestedMax,
                hasSwapOffer,
                buildAiInvestmentPreset,
            ),
        };
    }

    private buildHeader(symbol: string, suggestion: AiSuggestionState): string {
        if (suggestion.source !== AiSuggestionSource.Prediction) {
            return AiStartMessages.fallbackNotice();
        }
        return AiStartMessages.suggestionBlock({
            symbol,
            lowerPrice: suggestion.lowerPrice,
            upperPrice: suggestion.upperPrice,
            orderCount: suggestion.orderCount,
            conservativePnlUsdc: suggestion.conservativePnlUsdc ?? null,
            periodDays: suggestion.periodDays,
            warnings: suggestion.warnings ?? [],
        });
    }

    private async resolveSuggestion(symbol: string): Promise<AiSuggestionState> {
        try {
            const bestGrid = await this.predictionApi.getBestGrid(symbol);
            const config = bestGrid?.recommendedConfig;
            if (bestGrid && config) {
                const orderCount = Math.min(
                    Math.max(config.nLevels, WIZARD_CONFIG.MIN_ORDERS),
                    WIZARD_CONFIG.MAX_ORDERS,
                );
                return {
                    source: AiSuggestionSource.Prediction,
                    lowerPrice: config.lower,
                    upperPrice: config.upper,
                    orderCount,
                    conservativePnlUsdc: bestGrid.conservativePnlUsdc,
                    warnings: bestGrid.warnings,
                    periodDays: bestGrid.periodDays,
                };
            }
            this.logger.warn({ symbol }, 'Prediction service returned no recommendation');
        } catch (error) {
            this.logger.warn({ error, symbol }, 'Best-grid fetch failed, falling back to defaults');
        }
        const [lowerPrice, upperPrice] = await this.computeFallbackRange(symbol);
        return {
            source: AiSuggestionSource.Fallback,
            lowerPrice,
            upperPrice,
            orderCount: WIZARD_CONFIG.DEFAULT_ORDERS,
        };
    }

    async handleInvestmentPreset(ctx: BotContext, key: string): Promise<StepResult> {
        return handleInvestmentPresetSelection(ctx, key, (text) => this.applyTextInput(ctx, text));
    }

    async handleTextInput(ctx: BotContext, text: string): Promise<StepResult> {
        return this.applyTextInput(ctx, text);
    }

    private async applyTextInput(ctx: BotContext, text: string): Promise<StepResult> {
        const session = ctx.session;
        const accountAddress = ctx.user?.accountAddress;
        if (!session.createGrid?.symbol || !accountAddress) {
            return null;
        }

        const investment = parseFloat(text);

        try {
            const orderCount =
                session.createGrid.aiSuggestion?.orderCount ?? WIZARD_CONFIG.DEFAULT_ORDERS;
            const storedUpper = session.createGrid.upperPrice;
            const storedLower = session.createGrid.lowerPrice;
            const [lowerPrice, upperPrice] =
                storedUpper && storedLower
                    ? [storedLower, storedUpper]
                    : await this.computeFallbackRange(session.createGrid.symbol);

            const result = await validateInvestment(
                {
                    investment,
                    orderCount,
                    symbol: session.createGrid.symbol,
                    upperPrice,
                    lowerPrice,
                    accountAddress,
                },
                this.tradingApi,
            );

            if (!result.valid) {
                session.createGrid.pendingError = result.errorMessage ?? undefined;
                return null;
            }

            session.createGrid.totalInvestmentUSDC = investment;
            session.createGrid.upperPrice = upperPrice;
            session.createGrid.lowerPrice = lowerPrice;
            session.createGrid.orderCount = orderCount;

            return { nextStep: SceneStep.Preview };
        } catch (error) {
            this.logger.error({ error }, 'Failed to validate balance in AI start step');
            session.createGrid.pendingError = ValidationTexts.fetchDataFailed(
                session.createGrid.symbol,
            );
            return null;
        }
    }

    private async computeFallbackRange(symbol: string): Promise<[number, number]> {
        const currentPrice = await this.tradingApi.getCurrentPrice(symbol);
        const priceOffset = currentPrice * (WIZARD_CONFIG.PRICE_RANGE_PERCENT / 100);
        return [currentPrice - priceOffset, currentPrice + priceOffset];
    }

    rollbackState(ctx: BotContext): void {
        if (ctx.session.createGrid) {
            delete ctx.session.createGrid.totalInvestmentUSDC;
            delete ctx.session.createGrid.upperPrice;
            delete ctx.session.createGrid.lowerPrice;
            delete ctx.session.createGrid.orderCount;
            delete ctx.session.createGrid.balanceSnapshot;
            delete ctx.session.createGrid.swapOffer;
            delete ctx.session.createGrid.swapOfferPrice;
            delete ctx.session.createGrid.swapFeedback;
            delete ctx.session.createGrid.aiSuggestion;
        }
    }
}
