import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BotContext } from '../../../types/bot-context';
import { InlineButton } from '@components/telegram/domain/models/inline-button';
import { CREATE_GRID_ACTIONS } from '../create-grid-actions';
import { WizardStep } from '../wizard/wizard-step';
import { SceneStep } from '../create-grid-scene-step';
import { StepResult } from '../wizard/step-result';
import { WizardMessageManager } from '../wizard/wizard-message-manager';
import { Inject } from '@nestjs/common';
import { INFO_CLIENT_PORT, InfoClientPort } from '@domain/ports/outbound/info-client.port';
import { UserBalanceExtractorService } from '@domain/services/user-balance-extractor/user-balance-extractor.service';
import { CapitalCalculatorService } from '@domain/services/capital-calculator/capital-calculator.service';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { GridMode } from '@domain/models/grid/grid-mode';
import { Decimal } from '@domain/models/primitives/decimal';
import { Config } from '@infra/config/config.schema';
import { logger } from '@infra/logger/logger';
import { WIZARD_CONFIG } from '@components/telegram/domain/models/constants/wizard-config';
import { BUTTON_LABELS } from '@components/telegram/domain/models/constants/button-labels.constants';
import { AdvancedInvestmentMessages } from '@components/telegram/domain/models/messages/wizard/advanced-investment.messages';
import { ValidationMessages } from '@components/telegram/domain/models/messages/wizard/validation.messages';

@Injectable()
export class AdvancedInvestmentStep implements WizardStep {
    readonly id = SceneStep.Investment;
    private readonly accountAddress: string;

    constructor(
        private readonly messageManager: WizardMessageManager,
        @Inject(INFO_CLIENT_PORT) private readonly hyperliquidClient: InfoClientPort,
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
                const userState = await this.hyperliquidClient.getUserSpotState(
                    this.accountAddress,
                );
                const { usdcBalance, baseBalance } = this.userBalanceExtractor.extractBalances(
                    userState,
                    symbol,
                );

                const tradingSymbol = TradingSymbol.fromString(symbol);
                const currentPrice = await this.hyperliquidClient.getCurrentPrice(tradingSymbol);
                const baseInUsdc = baseBalance.mul(Decimal.from(currentPrice.toNumber()));
                const totalBalance = usdcBalance.add(baseInUsdc);

                const minBalance = usdcBalance.lt(baseInUsdc) ? usdcBalance : baseInUsdc;
                const suggestedMax = minBalance.mul(Decimal.from(2)).toNumber();
                const suggestedMaxRounded = Math.floor(suggestedMax);

                message = AdvancedInvestmentMessages.promptWithBalance(
                    symbol,
                    usdcBalance,
                    baseBalance,
                    baseInUsdc,
                    totalBalance,
                    currentPrice.toNumber(),
                    suggestedMaxRounded,
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

        const investment = parseFloat(text);

        if (isNaN(investment) || investment < WIZARD_CONFIG.MIN_INVESTMENT) {
            await this.messageManager.sendEnterMessage(
                ctx,
                ValidationMessages.invalidAmount(WIZARD_CONFIG.MIN_INVESTMENT),
            );
            return null;
        }

        const perOrderAmount = investment / session.createGrid.levels;
        if (perOrderAmount < WIZARD_CONFIG.MIN_INVESTMENT) {
            const keyboard: InlineButton[][] = [
                [
                    { text: BUTTON_LABELS.BACK, action: CREATE_GRID_ACTIONS.BACK },
                    { text: BUTTON_LABELS.CANCEL, action: CREATE_GRID_ACTIONS.CANCEL },
                ],
            ];
            session.createGrid.showingValidationError = true;
            await this.messageManager.sendEnterMessage(
                ctx,
                ValidationMessages.orderSizeTooSmall(
                    session.createGrid.levels,
                    perOrderAmount,
                    WIZARD_CONFIG.MIN_INVESTMENT,
                ),
                keyboard,
            );
            return null;
        }

        try {
            const tradingSymbol = TradingSymbol.fromString(session.createGrid.symbol);
            const currentPrice = await this.hyperliquidClient.getCurrentPrice(tradingSymbol);

            const userState = await this.hyperliquidClient.getUserSpotState(this.accountAddress);
            const { usdcBalance, baseBalance } = this.userBalanceExtractor.extractBalances(
                userState,
                session.createGrid.symbol,
            );

            const distribution = this.capitalCalculator.calculateDistribution({
                mode: GridMode.Neutral,
                totalInvestmentUSDC: investment,
                usdcBalance,
                baseBalance,
                currentPrice,
                lowerPrice: session.createGrid.lowerPrice,
                upperPrice: session.createGrid.upperPrice,
            });

            // Validate balance sufficiency
            const usdcShortfall = distribution.investmentUSDC.sub(usdcBalance);
            const baseShortfall = distribution.investmentBase.sub(baseBalance);
            const hasInsufficientBalance =
                usdcShortfall.gt(Decimal.zero()) || baseShortfall.gt(Decimal.zero());

            if (hasInsufficientBalance) {
                const keyboard: InlineButton[][] = [
                    [
                        { text: BUTTON_LABELS.BACK, action: CREATE_GRID_ACTIONS.BACK },
                        { text: BUTTON_LABELS.CANCEL, action: CREATE_GRID_ACTIONS.CANCEL },
                    ],
                ];

                const baseInUsdc = baseBalance.mul(Decimal.from(currentPrice.toNumber()));
                const totalBalance = usdcBalance.add(baseInUsdc);

                const errorMessage = ValidationMessages.insufficientBalance(
                    session.createGrid.symbol,
                    usdcBalance,
                    baseBalance,
                    baseInUsdc,
                    totalBalance,
                    currentPrice.toNumber(),
                    distribution.investmentUSDC,
                    distribution.investmentBase,
                    usdcShortfall.gt(Decimal.zero()) ? usdcShortfall : null,
                    baseShortfall.gt(Decimal.zero()) ? baseShortfall : null,
                );

                session.createGrid.showingValidationError = true;
                await this.messageManager.sendEnterMessage(ctx, errorMessage, keyboard);
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
