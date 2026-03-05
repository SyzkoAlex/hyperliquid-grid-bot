import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BotContext } from '../../../types/bot-context';
import { InlineButton } from '@components/telegram/core/domain/models/inline-button';
import { CREATE_GRID_ACTIONS } from '../create-grid-actions';
import { Inject } from '@nestjs/common';
import { TRADING_API_PORT, TradingApiPort } from '@components/trading/api/trading-api.port';
import { GridMode } from '@domain/models/grid/grid-mode';
import { Config } from '@/config/config.schema';
import { logger } from '@/infra/logger/logger';
import { WizardStep } from '../wizard/wizard-step';
import { SceneStep } from '../create-grid-scene-step';
import { StepResult } from '../wizard/step-result';
import { WizardMessageManager } from '../wizard/wizard-message-manager';
import { WIZARD_CONFIG } from '@components/telegram/core/domain/models/constants/wizard-config';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels';
import { QuickStartMessages } from '@components/telegram/core/domain/models/messages/wizard/quick-start.messages';
import { ValidationMessages } from '@components/telegram/core/domain/models/messages/wizard/validation.messages';
import { fetchBalanceInfo } from '../helpers/balance-info';
import { validateInvestment } from '../helpers/investment-validator';

@Injectable()
export class QuickStartStep implements WizardStep {
    readonly id = SceneStep.Quick;
    private readonly accountAddress: string;

    constructor(
        @Inject(TRADING_API_PORT) private readonly tradingApi: TradingApiPort,
        private readonly messageManager: WizardMessageManager,
        configService: ConfigService<Config, true>,
    ) {
        this.accountAddress = configService.get('hyperliquid.accountAddress', { infer: true });
    }

    async enter(ctx: BotContext): Promise<void> {
        const session = ctx.session;
        const symbol = session.createGrid?.symbol;

        const keyboard: InlineButton[][] = [
            [
                { text: BUTTON_LABELS.BACK, action: CREATE_GRID_ACTIONS.BACK },
                { text: BUTTON_LABELS.CANCEL, action: CREATE_GRID_ACTIONS.CANCEL },
            ],
        ];

        let message = QuickStartMessages.promptWithoutBalance();

        if (symbol) {
            try {
                const balanceInfo = await fetchBalanceInfo(
                    this.tradingApi,
                    this.accountAddress,
                    symbol,
                );

                if (balanceInfo.baseBalance.isZero()) {
                    await this.messageManager.sendEnterMessage(
                        ctx,
                        ValidationMessages.zeroBaseBalance(symbol, balanceInfo.usdcBalance),
                        keyboard,
                    );
                    return;
                }

                if (balanceInfo.usdcBalance.isZero()) {
                    await this.messageManager.sendEnterMessage(
                        ctx,
                        ValidationMessages.zeroUsdcBalance(symbol, balanceInfo.baseBalance),
                        keyboard,
                    );
                    return;
                }

                message = QuickStartMessages.promptWithBalance(
                    symbol,
                    balanceInfo.usdcBalance,
                    balanceInfo.baseBalance,
                    balanceInfo.baseInUsdc,
                    balanceInfo.totalBalance,
                    balanceInfo.currentPrice,
                    balanceInfo.suggestedMaxRounded,
                );
            } catch (error) {
                logger.warn({ error }, 'Failed to fetch balance in quick start step');
            }
        }

        await this.messageManager.sendEnterMessage(ctx, message, keyboard);
    }

    async handleTextInput(ctx: BotContext, text: string): Promise<StepResult> {
        const session = ctx.session;
        if (!session.createGrid?.symbol) {
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
                    accountAddress: this.accountAddress,
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
            session.createGrid.upperPrice = upperPrice;
            session.createGrid.lowerPrice = lowerPrice;
            session.createGrid.levels = WIZARD_CONFIG.DEFAULT_LEVELS;
            session.createGrid.gridMode = GridMode.Neutral;

            return {
                nextStep: SceneStep.Preview,
                confirmations: [QuickStartMessages.confirmation(investment)],
            };
        } catch (error) {
            await this.messageManager.sendEnterMessage(
                ctx,
                ValidationMessages.fetchDataFailed(session.createGrid.symbol),
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
        }
    }
}
