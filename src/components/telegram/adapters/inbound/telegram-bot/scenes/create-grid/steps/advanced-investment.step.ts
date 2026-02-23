import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BotContext } from '../../../types/bot-context';
import { InlineButton } from '@components/telegram/core/domain/models/inline-button';
import { CREATE_GRID_ACTIONS } from '../create-grid-actions';
import { WizardStep } from '../wizard/wizard-step';
import { SceneStep } from '../create-grid-scene-step';
import { StepResult } from '../wizard/step-result';
import { WizardMessageManager } from '../wizard/wizard-message-manager';
import { Inject } from '@nestjs/common';
import {
    EXCHANGE_INFO_PORT,
    ExchangeInfoPort,
} from '@components/telegram/core/application/ports/exchange-info.port';
import { UserBalanceExtractorService } from '@domain/services/user-balance-extractor/user-balance-extractor.service';
import { CapitalCalculatorService } from '@domain/services/capital-calculator/capital-calculator.service';
import { GridMode } from '@domain/models/grid/grid-mode';
import { Config } from '@/config/config.schema';
import { logger } from '@/infra/logger/logger';
import { WIZARD_CONFIG } from '@components/telegram/core/domain/models/constants/wizard-config';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels.constants';
import { AdvancedInvestmentMessages } from '@components/telegram/core/domain/models/messages/wizard/advanced-investment.messages';
import { ValidationMessages } from '@components/telegram/core/domain/models/messages/wizard/validation.messages';
import { fetchBalanceInfo } from '../helpers/balance-info';
import { validateInvestment } from '../helpers/investment-validator';

@Injectable()
export class AdvancedInvestmentStep implements WizardStep {
    readonly id = SceneStep.Investment;
    private readonly accountAddress: string;

    constructor(
        private readonly messageManager: WizardMessageManager,
        @Inject(EXCHANGE_INFO_PORT) private readonly hyperliquidClient: ExchangeInfoPort,
        private readonly userBalanceExtractor: UserBalanceExtractorService,
        private readonly capitalCalculator: CapitalCalculatorService,
        configService: ConfigService<Config, true>,
    ) {
        this.accountAddress = configService.get('hyperliquid.accountAddress', { infer: true });
    }

    async enter(ctx: BotContext): Promise<void> {
        const session = ctx.session;
        const symbol = session.createGrid?.symbol;
        const levels = session.createGrid?.levels || WIZARD_CONFIG.DEFAULT_LEVELS;

        const keyboard: InlineButton[][] = [
            [
                { text: BUTTON_LABELS.BACK, action: CREATE_GRID_ACTIONS.BACK },
                { text: BUTTON_LABELS.CANCEL, action: CREATE_GRID_ACTIONS.CANCEL },
            ],
        ];

        let message = AdvancedInvestmentMessages.promptWithoutBalance();

        if (symbol) {
            try {
                const balanceInfo = await fetchBalanceInfo(
                    this.hyperliquidClient,
                    this.userBalanceExtractor,
                    this.accountAddress,
                    symbol,
                );
                message = AdvancedInvestmentMessages.promptWithBalance(
                    symbol,
                    balanceInfo.usdcBalance,
                    balanceInfo.baseBalance,
                    balanceInfo.baseInUsdc,
                    balanceInfo.totalBalance,
                    balanceInfo.currentPrice,
                    balanceInfo.suggestedMaxRounded,
                    levels,
                );
            } catch (error) {
                logger.warn({ error }, 'Failed to fetch balance in advanced investment step');
            }
        }

        await this.messageManager.sendEnterMessage(ctx, message, keyboard);
    }

    async handleTextInput(ctx: BotContext, text: string): Promise<StepResult> {
        const session = ctx.session;
        if (
            !session.createGrid?.levels ||
            !session.createGrid?.upperPrice ||
            !session.createGrid?.lowerPrice ||
            !session.createGrid?.symbol
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
                    accountAddress: this.accountAddress,
                },
                this.hyperliquidClient,
                this.userBalanceExtractor,
                this.capitalCalculator,
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
            session.createGrid.gridMode = GridMode.Neutral;
            return {
                nextStep: SceneStep.Preview,
                confirmations: [AdvancedInvestmentMessages.confirmation(investment)],
            };
        } catch (error) {
            logger.error({ error }, 'Failed to validate balance in advanced investment step');
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
        }
    }
}
