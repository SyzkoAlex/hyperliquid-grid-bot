import { Inject, Injectable } from '@nestjs/common';
import { BotContext } from '../../../types/bot-context';
import { InlineButton } from '@components/telegram/core/domain/models/inline-button';
import {
    CREATE_GRID_ACTIONS,
    InvestmentPresetKey,
    buildQuickInvestmentPreset,
} from '../create-grid-actions';
import { TRADING_API_PORT, TradingApiPort } from '@components/trading/api/trading-api.port';
import { logger } from '@/infra/logger/logger';
import { WizardStep } from '../wizard/wizard-step';
import { SceneStep } from '../create-grid-scene-step';
import { StepResult } from '../wizard/step-result';
import { StepView } from '../wizard/step-view';
import { WIZARD_CONFIG } from '@components/telegram/core/domain/models/constants/wizard-config';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels';
import { EMOJI } from '@components/telegram/core/domain/models/constants/emoji';
import { QuickStartPromptMessage } from '@components/telegram/core/domain/models/messages/wizard/quick-start.messages';
import { ValidationTexts } from '@components/telegram/core/domain/models/messages/wizard/validation.texts';
import { buildInvestmentView } from '../helpers/investment-view-builder';
import { validateInvestment } from '../helpers/investment-validator';

@Injectable()
export class QuickStartStep implements WizardStep {
    readonly id = SceneStep.Quick;
    private readonly logger = logger.child({ context: QuickStartStep.name });

    constructor(@Inject(TRADING_API_PORT) private readonly tradingApi: TradingApiPort) {}

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
        let body = QuickStartPromptMessage.create().text;
        let hasSwapOffer = false;

        if (symbol && accountAddress) {
            try {
                // After a swap, the exchange balance endpoint may lag behind the
                // fill settlement — wait briefly so preset buttons reflect the
                // post-swap state.
                if (swapFeedback) {
                    await new Promise<void>((resolve) =>
                        setTimeout(resolve, WIZARD_CONFIG.SWAP_BALANCE_SETTLE_DELAY_MS),
                    );
                }

                const currentPrice = await this.tradingApi.getCurrentPrice(symbol);
                const priceOffset = currentPrice * (WIZARD_CONFIG.PRICE_RANGE_PERCENT / 100);
                const upperPrice = currentPrice + priceOffset;
                const lowerPrice = currentPrice - priceOffset;

                const result = await buildInvestmentView(
                    this.tradingApi,
                    accountAddress,
                    symbol,
                    WIZARD_CONFIG.DEFAULT_LEVELS,
                    lowerPrice,
                    upperPrice,
                    {
                        fallback: () => QuickStartPromptMessage.create().text,
                        withBalance: (info) =>
                            QuickStartPromptMessage.create({
                                symbol: info.symbol,
                                usdcBalance: info.usdcBalance,
                                baseBalance: info.baseBalance,
                                baseInUsdc: info.baseInUsdc,
                                totalBalance: info.totalBalance,
                                currentPrice: info.currentPrice,
                                suggestedMax: info.suggestedMax,
                                lowerPrice: info.lowerPrice,
                                upperPrice: info.upperPrice,
                            }).text,
                    },
                );

                body = result.body;
                suggestedMax = result.suggestedMax;

                if (suggestedMax !== null && session.createGrid) {
                    session.createGrid.balanceSnapshot = { suggestedMax };
                }

                if (session.createGrid) {
                    if (result.swapOffer) {
                        session.createGrid.swapOffer = result.swapOffer;
                        hasSwapOffer = true;
                    } else {
                        delete session.createGrid.swapOffer;
                    }
                }
            } catch (error) {
                this.logger.warn({ error }, 'Failed to fetch balance in quick start step');
            }
        }

        if (swapFeedback) {
            body = `${swapFeedback}\n\n${body}`;
        }

        return {
            body,
            keyboard: this.buildKeyboard(suggestedMax, hasSwapOffer),
        };
    }

    private buildKeyboard(suggestedMax: number | null, hasSwapOffer = false): InlineButton[][] {
        const isProactiveSwap = suggestedMax !== null && hasSwapOffer;
        const rows: InlineButton[][] = [];
        if (suggestedMax !== null) {
            rows.push(
                [
                    {
                        text: `25% ($${Math.round(suggestedMax * 0.25)})`,
                        action: buildQuickInvestmentPreset(InvestmentPresetKey.P25),
                    },
                    {
                        text: `50% ($${Math.round(suggestedMax * 0.5)})`,
                        action: buildQuickInvestmentPreset(InvestmentPresetKey.P50),
                    },
                ],
                [
                    {
                        text: `75% ($${Math.round(suggestedMax * 0.75)})`,
                        action: buildQuickInvestmentPreset(InvestmentPresetKey.P75),
                    },
                    {
                        text: `Max ($${suggestedMax})`,
                        action: buildQuickInvestmentPreset(InvestmentPresetKey.Max),
                    },
                ],
            );
        }
        if (hasSwapOffer) {
            const swapLabel = isProactiveSwap
                ? `${EMOJI.REFRESH} Swap to maximize`
                : `${EMOJI.REFRESH} Swap to fit grid`;
            rows.push([{ text: swapLabel, action: CREATE_GRID_ACTIONS.SWAP_OFFER }]);
        }
        rows.push([
            {
                text: BUTTON_LABELS.CUSTOM,
                action: buildQuickInvestmentPreset(InvestmentPresetKey.Custom),
            },
        ]);
        rows.push([
            { text: BUTTON_LABELS.BACK, action: CREATE_GRID_ACTIONS.BACK },
            { text: BUTTON_LABELS.CANCEL, action: CREATE_GRID_ACTIONS.CANCEL },
        ]);
        return rows;
    }

    async handleInvestmentPreset(ctx: BotContext, key: string): Promise<StepResult> {
        if (key === InvestmentPresetKey.Custom) {
            if (ctx.session.createGrid) {
                ctx.session.createGrid.pendingError = ValidationTexts.enterCustomInvestment();
            }
            return null;
        }
        const snapshot = ctx.session.createGrid?.balanceSnapshot;
        if (!snapshot) return null;
        const { suggestedMax } = snapshot;
        let investment: number;
        switch (key) {
            case InvestmentPresetKey.P25:
                investment = Math.round(suggestedMax * 0.25);
                break;
            case InvestmentPresetKey.P50:
                investment = Math.round(suggestedMax * 0.5);
                break;
            case InvestmentPresetKey.P75:
                investment = Math.round(suggestedMax * 0.75);
                break;
            case InvestmentPresetKey.Max:
                investment = suggestedMax;
                break;
            default:
                return null;
        }
        return this.applyTextInput(ctx, String(investment));
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
            const currentPrice = await this.tradingApi.getCurrentPrice(session.createGrid.symbol);
            const priceOffset = currentPrice * (WIZARD_CONFIG.PRICE_RANGE_PERCENT / 100);
            const upperPrice = currentPrice + priceOffset;
            const lowerPrice = currentPrice - priceOffset;

            const result = await validateInvestment(
                {
                    investment,
                    levels: WIZARD_CONFIG.DEFAULT_LEVELS,
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
            session.createGrid.levels = WIZARD_CONFIG.DEFAULT_LEVELS;

            return { nextStep: SceneStep.Preview };
        } catch (error) {
            this.logger.error({ error }, 'Failed to validate balance in quick start step');
            session.createGrid.pendingError = ValidationTexts.fetchDataFailed(
                session.createGrid.symbol,
            );
            return null;
        }
    }

    rollbackState(ctx: BotContext): void {
        if (ctx.session.createGrid) {
            delete ctx.session.createGrid.totalInvestmentUSDC;
            delete ctx.session.createGrid.upperPrice;
            delete ctx.session.createGrid.lowerPrice;
            delete ctx.session.createGrid.levels;
            delete ctx.session.createGrid.balanceSnapshot;
            delete ctx.session.createGrid.swapOffer;
            delete ctx.session.createGrid.swapFeedback;
        }
    }
}
