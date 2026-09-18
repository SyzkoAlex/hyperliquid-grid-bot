import { Inject, Injectable } from '@nestjs/common';
import { BotContext } from '../../../types/bot-context';
import { buildAdvInvestmentPreset } from '../create-grid-actions';
import { WizardStep } from '../wizard/wizard-step';
import { SceneStep } from '../create-grid-scene-step';
import { StepResult } from '../wizard/step-result';
import { StepView } from '../wizard/step-view';
import { TRADING_API_PORT, TradingApiPort } from '@components/trading/api/trading-api.port';
import { logger } from '@/infra/logger/logger';
import { WIZARD_CONFIG } from '@components/telegram/core/domain/models/constants/wizard-config';
import { AdvancedInvestmentPromptMessage } from '@components/telegram/core/domain/models/messages/wizard/advanced-investment.messages';
import { ValidationTexts } from '@components/telegram/core/domain/models/messages/wizard/validation.texts';
import { buildInvestmentView } from '../helpers/investment-view-builder';
import { validateInvestment } from '../helpers/investment-validator';
import { buildInvestmentPresetKeyboard } from '../helpers/investment-preset-keyboard';
import { handleInvestmentPresetSelection } from '../helpers/investment-preset-selection';
import { awaitSwapBalanceSettle, persistSwapOffer } from '../helpers/swap-session.helpers';

@Injectable()
export class AdvancedInvestmentStep implements WizardStep {
    readonly id = SceneStep.Investment;
    private readonly logger = logger.child({ context: AdvancedInvestmentStep.name });

    constructor(@Inject(TRADING_API_PORT) private readonly tradingApi: TradingApiPort) {}

    async buildView(ctx: BotContext): Promise<StepView> {
        const session = ctx.session;
        const symbol = session.createGrid?.symbol;
        const orderCount = session.createGrid?.orderCount ?? WIZARD_CONFIG.DEFAULT_ORDERS;
        const accountAddress = ctx.user?.accountAddress;

        // Consume and clear the post-swap success banner set by SwapStep
        const swapFeedback = session.createGrid?.swapFeedback;
        if (swapFeedback && session.createGrid) {
            delete session.createGrid.swapFeedback;
        }

        let suggestedMax: number | null = null;
        let body = AdvancedInvestmentPromptMessage.create().text;
        let hasSwapOffer = false;

        if (symbol && accountAddress) {
            try {
                // After a swap, the exchange balance endpoint may lag behind the
                // fill settlement — wait briefly so preset buttons reflect the
                // post-swap state.
                await awaitSwapBalanceSettle(swapFeedback);
                const storedUpper = session.createGrid?.upperPrice;
                const storedLower = session.createGrid?.lowerPrice;
                const [lowerPrice, upperPrice] =
                    storedUpper && storedLower
                        ? [storedLower, storedUpper]
                        : await this.computePriceRange(symbol);

                const result = await buildInvestmentView(
                    this.tradingApi,
                    accountAddress,
                    symbol,
                    orderCount,
                    lowerPrice,
                    upperPrice,
                    {
                        fallback: () => AdvancedInvestmentPromptMessage.create().text,
                        withBalance: (info) =>
                            AdvancedInvestmentPromptMessage.create({
                                symbol: info.symbol,
                                usdcBalance: info.usdcBalance,
                                baseBalance: info.baseBalance,
                                baseInUsdc: info.baseInUsdc,
                                totalBalance: info.totalBalance,
                                currentPrice: info.currentPrice,
                                suggestedMax: info.suggestedMax,
                                orderCount,
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
                    hasSwapOffer = persistSwapOffer(
                        session.createGrid,
                        result.swapOffer,
                        result.swapOfferPrice,
                    );
                }
            } catch (error) {
                this.logger.warn({ error }, 'Failed to fetch balance in advanced investment step');
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
                buildAdvInvestmentPreset,
            ),
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
        if (
            !session.createGrid?.orderCount ||
            !session.createGrid?.upperPrice ||
            !session.createGrid?.lowerPrice ||
            !session.createGrid?.symbol ||
            !accountAddress
        ) {
            return null;
        }

        const investment = parseFloat(text);

        try {
            const result = await validateInvestment(
                {
                    investment,
                    orderCount: session.createGrid.orderCount,
                    symbol: session.createGrid.symbol,
                    upperPrice: session.createGrid.upperPrice,
                    lowerPrice: session.createGrid.lowerPrice,
                    accountAddress,
                },
                this.tradingApi,
            );

            if (!result.valid) {
                session.createGrid.pendingError = result.errorMessage ?? undefined;
                persistSwapOffer(session.createGrid, result.swapOffer, result.swapOfferPrice);
                return null;
            }

            session.createGrid.totalInvestmentUSDC = investment;
            return { nextStep: SceneStep.StopLoss };
        } catch (error) {
            this.logger.error({ error }, 'Failed to validate balance in advanced investment step');
            session.createGrid.pendingError = ValidationTexts.fetchDataFailed(
                session.createGrid.symbol,
            );
            return null;
        }
    }

    private async computePriceRange(symbol: string): Promise<[number, number]> {
        const currentPrice = await this.tradingApi.getCurrentPrice(symbol);
        const priceOffset = currentPrice * (WIZARD_CONFIG.PRICE_RANGE_PERCENT / 100);
        return [currentPrice - priceOffset, currentPrice + priceOffset];
    }

    rollbackState(ctx: BotContext): void {
        if (ctx.session.createGrid) {
            delete ctx.session.createGrid.totalInvestmentUSDC;
            delete ctx.session.createGrid.balanceSnapshot;
            delete ctx.session.createGrid.swapOffer;
            delete ctx.session.createGrid.swapOfferPrice;
            delete ctx.session.createGrid.swapFeedback;
        }
    }
}
