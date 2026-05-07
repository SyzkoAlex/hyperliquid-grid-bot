import { Inject, Injectable } from '@nestjs/common';
import { BotContext } from '../../../types/bot-context';
import { InlineButton } from '@components/telegram/core/domain/models/inline-button';
import { CREATE_GRID_ACTIONS } from '../create-grid-actions';
import { WizardStep } from '../wizard/wizard-step';
import { SceneStep } from '../create-grid-scene-step';
import { StepResult } from '../wizard/step-result';
import { WizardMessageManager } from '../wizard/wizard-message-manager';
import { TRADING_API_PORT, TradingApiPort } from '@components/trading/api/trading-api.port';
import { logger } from '@/infra/logger/logger';
import { WIZARD_CONFIG } from '@components/telegram/core/domain/models/constants/wizard-config';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels';
import {
    AdvancedInvestmentConfirmationMessage,
    AdvancedInvestmentPromptMessage,
} from '@components/telegram/core/domain/models/messages/wizard/advanced-investment.messages';
import { ValidationTexts } from '@components/telegram/core/domain/models/messages/wizard/validation.texts';
import { fetchBalanceInfo } from '../helpers/balance-info';
import { validateInvestment } from '../helpers/investment-validator';

@Injectable()
export class AdvancedInvestmentStep implements WizardStep {
    readonly id = SceneStep.Investment;

    constructor(
        private readonly messageManager: WizardMessageManager,
        @Inject(TRADING_API_PORT) private readonly tradingApi: TradingApiPort,
    ) {}

    async enter(ctx: BotContext): Promise<void> {
        const session = ctx.session;
        const symbol = session.createGrid?.symbol;
        const levels = session.createGrid?.levels || WIZARD_CONFIG.DEFAULT_LEVELS;
        const accountAddress = ctx.user?.accountAddress;

        const keyboard: InlineButton[][] = [
            [
                { text: BUTTON_LABELS.BACK, action: CREATE_GRID_ACTIONS.BACK },
                { text: BUTTON_LABELS.CANCEL, action: CREATE_GRID_ACTIONS.CANCEL },
            ],
        ];

        let message = AdvancedInvestmentPromptMessage.create().text;

        if (symbol && accountAddress) {
            try {
                const upperPrice = session.createGrid?.upperPrice;
                const lowerPrice = session.createGrid?.lowerPrice;
                const balanceInfo =
                    upperPrice && lowerPrice
                        ? await fetchBalanceInfo(
                              this.tradingApi,
                              accountAddress,
                              symbol,
                              levels,
                              lowerPrice,
                              upperPrice,
                          )
                        : await this.fetchBalanceInfoFromCurrentPrice(
                              accountAddress,
                              symbol,
                              levels,
                          );

                if (balanceInfo.baseBalance.isZero()) {
                    await this.messageManager.sendEnterMessage(
                        ctx,
                        ValidationTexts.zeroBaseBalance(symbol, balanceInfo.usdcBalance),
                        keyboard,
                    );
                    return;
                }

                if (balanceInfo.usdcBalance.isZero()) {
                    await this.messageManager.sendEnterMessage(
                        ctx,
                        ValidationTexts.zeroUsdcBalance(symbol, balanceInfo.baseBalance),
                        keyboard,
                    );
                    return;
                }

                const minRequired = (levels + 1) * WIZARD_CONFIG.MIN_INVESTMENT;
                if (balanceInfo.suggestedMaxRounded < minRequired) {
                    await this.messageManager.sendEnterMessage(
                        ctx,
                        ValidationTexts.insufficientBalanceForGrid(
                            levels,
                            minRequired,
                            balanceInfo.suggestedMaxRounded,
                        ),
                        keyboard,
                    );
                    return;
                }

                message = AdvancedInvestmentPromptMessage.create({
                    symbol,
                    usdcBalance: balanceInfo.usdcBalance,
                    baseBalance: balanceInfo.baseBalance,
                    baseInUsdc: balanceInfo.baseInUsdc,
                    totalBalance: balanceInfo.totalBalance,
                    currentPrice: balanceInfo.currentPrice,
                    suggestedMax: balanceInfo.suggestedMaxRounded,
                    levels,
                }).text;
            } catch (error) {
                logger.warn({ error }, 'Failed to fetch balance in advanced investment step');
            }
        }

        await this.messageManager.sendEnterMessage(ctx, message, keyboard);
    }

    async handleTextInput(ctx: BotContext, text: string): Promise<StepResult> {
        const session = ctx.session;
        const accountAddress = ctx.user?.accountAddress;
        if (
            !session.createGrid?.levels ||
            !session.createGrid?.upperPrice ||
            !session.createGrid?.lowerPrice ||
            !session.createGrid?.symbol ||
            !accountAddress
        ) {
            return null;
        }

        const keyboard: InlineButton[][] = [
            [
                { text: BUTTON_LABELS.BACK, action: CREATE_GRID_ACTIONS.BACK },
                { text: BUTTON_LABELS.CANCEL, action: CREATE_GRID_ACTIONS.CANCEL },
            ],
        ];

        const investment = parseFloat(text);

        try {
            const result = await validateInvestment(
                {
                    investment,
                    levels: session.createGrid.levels,
                    symbol: session.createGrid.symbol,
                    upperPrice: session.createGrid.upperPrice,
                    lowerPrice: session.createGrid.lowerPrice,
                    accountAddress,
                },
                this.tradingApi,
            );

            if (!result.valid) {
                if (result.showBackButton) {
                    session.createGrid.showingValidationError = true;
                }
                await this.messageManager.sendEnterMessage(
                    ctx,
                    result.errorMessage!,
                    result.showBackButton ? keyboard : undefined,
                );
                return null;
            }

            session.createGrid.totalInvestmentUSDC = investment;
            return {
                nextStep: SceneStep.StopLoss,
                confirmations: [AdvancedInvestmentConfirmationMessage.create(investment).text],
            };
        } catch (error) {
            logger.error({ error }, 'Failed to validate balance in advanced investment step');
            await this.messageManager.sendEnterMessage(
                ctx,
                ValidationTexts.fetchDataFailed(session.createGrid.symbol),
            );
            return null;
        }
    }

    private async fetchBalanceInfoFromCurrentPrice(
        accountAddress: string,
        symbol: string,
        levels: number,
    ): Promise<ReturnType<typeof fetchBalanceInfo>> {
        const currentPrice = await this.tradingApi.getCurrentPrice(symbol);
        const priceOffset = currentPrice * (WIZARD_CONFIG.PRICE_RANGE_PERCENT / 100);
        return fetchBalanceInfo(
            this.tradingApi,
            accountAddress,
            symbol,
            levels,
            currentPrice - priceOffset,
            currentPrice + priceOffset,
        );
    }

    rollbackState(ctx: BotContext): void {
        if (ctx.session.createGrid) {
            delete ctx.session.createGrid.totalInvestmentUSDC;
        }
    }
}
