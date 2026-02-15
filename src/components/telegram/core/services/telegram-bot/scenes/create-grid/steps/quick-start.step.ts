import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BotContext } from '../../../types/bot-context';
import { InlineButton } from '../../../../../domain/inline-button';
import { CREATE_GRID_ACTIONS } from '../create-grid-actions';
import { HyperliquidInfoClient } from '@components/shared/secondary/clients/hyperliquid-info.client';
import { TradingSymbol } from '@domain/primitives/trading-symbol';
import { UserBalanceExtractorService } from '@components/shared/core/services/user-balance-extractor/user-balance-extractor.service';
import { CapitalCalculatorService } from '@components/shared/core/services/capital-calculator/capital-calculator.service';
import { GridMode } from '@domain/grid/grid-mode';
import { Config } from '@infra/config/config.schema';
import { Decimal } from '@domain/primitives/decimal';
import { logger } from '@infra/logger/logger';
import { WizardStep } from '../wizard/wizard-step';
import { SceneStep } from '../create-grid-scene-step';
import { StepResult } from '../wizard/step-result';
import { WizardMessageManager } from '../wizard/wizard-message-manager';
import { WIZARD_CONFIG } from '../../../../../domain/constants/wizard-config';
import { BUTTON_LABELS } from '../../../../../domain/constants/button-labels.constants';
import { QuickStartMessages } from '../../../../../domain/messages/wizard/quick-start.messages';
import { ValidationMessages } from '../../../../../domain/messages/wizard/validation.messages';

@Injectable()
export class QuickStartStep implements WizardStep {
    readonly id = SceneStep.Quick;
    private readonly accountAddress: string;

    constructor(
        private readonly hyperliquidClient: HyperliquidInfoClient,
        private readonly userBalanceExtractor: UserBalanceExtractorService,
        private readonly capitalCalculator: CapitalCalculatorService,
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

                message = QuickStartMessages.promptWithBalance(
                    symbol,
                    usdcBalance,
                    baseBalance,
                    baseInUsdc,
                    totalBalance,
                    currentPrice.toNumber(),
                    suggestedMaxRounded,
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

        const investment = parseFloat(text);

        if (isNaN(investment) || investment < WIZARD_CONFIG.MIN_INVESTMENT) {
            await this.messageManager.sendEnterMessage(
                ctx,
                ValidationMessages.invalidAmount(WIZARD_CONFIG.MIN_INVESTMENT),
            );
            return null;
        }

        const perOrderAmount = investment / WIZARD_CONFIG.DEFAULT_LEVELS;
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
                    WIZARD_CONFIG.DEFAULT_LEVELS,
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
            const priceOffset = currentPrice.toNumber() * (WIZARD_CONFIG.PRICE_RANGE_PERCENT / 100);
            const upperPrice = currentPrice.toNumber() + priceOffset;
            const lowerPrice = currentPrice.toNumber() - priceOffset;

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
                lowerPrice,
                upperPrice,
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
