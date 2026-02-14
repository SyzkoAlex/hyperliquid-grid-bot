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

const MIN_INVESTMENT = 10;
const PRICE_RANGE_PERCENT = 20;
const DEFAULT_LEVELS = 10;

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
                { text: '← Back', action: CREATE_GRID_ACTIONS.BACK },
                { text: '❌ Cancel', action: CREATE_GRID_ACTIONS.CANCEL },
            ],
        ];

        let message = `How much USDC do you want to invest?\n\nMinimum: ${MIN_INVESTMENT} USDC per order`;

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

                message =
                    `💵 Your balance:\n` +
                    `  • USDC: ${usdcBalance.toString()}\n` +
                    `  • ${symbol}: ${baseBalance.toString()} (${baseInUsdc.toFixed(2)} USDC)\n\n` +
                    `${symbol} price: $${currentPrice.toNumber().toFixed(2)}\n\n` +
                    `Total balance: ${totalBalance.toFixed(2)} USDC\n\n` +
                    `How much USDC do you want to invest?\n\n` +
                    `Minimum: ${MIN_INVESTMENT} USDC per order\n\n` +
                    `💡 Suggested max: ~${suggestedMaxRounded} USDC (for ${DEFAULT_LEVELS} levels, neutral mode)`;
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

        if (isNaN(investment) || investment < MIN_INVESTMENT) {
            await this.messageManager.sendEnterMessage(
                ctx,
                `❌ Invalid amount. Minimum investment: ${MIN_INVESTMENT} USDC\n\nPlease enter a valid amount:`,
            );
            return null;
        }

        // Validate per-order amount
        const perOrderAmount = investment / DEFAULT_LEVELS;
        if (perOrderAmount < MIN_INVESTMENT) {
            const keyboard: InlineButton[][] = [
                [
                    { text: '← Back', action: CREATE_GRID_ACTIONS.BACK },
                    { text: '❌ Cancel', action: CREATE_GRID_ACTIONS.CANCEL },
                ],
            ];
            session.createGrid.showingValidationError = true;
            await this.messageManager.sendEnterMessage(
                ctx,
                `❌ Order size too small!\n\n` +
                    `With ${DEFAULT_LEVELS} levels, each order would be ${perOrderAmount.toFixed(2)} USDC.\n` +
                    `Minimum per order: ${MIN_INVESTMENT} USDC\n\n` +
                    `Please increase your investment to at least ${MIN_INVESTMENT * DEFAULT_LEVELS} USDC.`,
                keyboard,
            );
            return null;
        }

        try {
            const tradingSymbol = TradingSymbol.fromString(session.createGrid.symbol);
            const currentPrice = await this.hyperliquidClient.getCurrentPrice(tradingSymbol);
            const priceOffset = currentPrice.toNumber() * (PRICE_RANGE_PERCENT / 100);
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
                        { text: '← Back', action: CREATE_GRID_ACTIONS.BACK },
                        { text: '❌ Cancel', action: CREATE_GRID_ACTIONS.CANCEL },
                    ],
                ];

                let errorMessage = `❌ Insufficient balance!\n\n`;
                errorMessage += `💵 Your balance:\n`;
                errorMessage += `  • USDC: ${usdcBalance.toString()}\n`;
                const baseInUsdc = baseBalance.mul(Decimal.from(currentPrice.toNumber()));
                errorMessage += `  • ${session.createGrid.symbol}: ${baseBalance.toString()} (${baseInUsdc.toFixed(2)} USDC)\n\n`;
                const totalBalance = usdcBalance.add(baseInUsdc);
                errorMessage += `${session.createGrid.symbol} price: $${currentPrice.toNumber().toFixed(2)}\n`;
                errorMessage += `Total balance: ${totalBalance.toFixed(2)} USDC\n\n`;
                errorMessage += `📈 Required for full grid:\n`;
                errorMessage += `  • USDC: ${distribution.investmentUSDC.toString()}\n`;
                errorMessage += `  • ${session.createGrid.symbol}: ${distribution.investmentBase.toString()}\n\n`;

                if (usdcShortfall.gt(Decimal.zero())) {
                    errorMessage += `⚠️ USDC shortfall: ${usdcShortfall.toFixed(2)} USDC\n`;
                }
                if (baseShortfall.gt(Decimal.zero())) {
                    const baseShortfallUsdc = baseShortfall.mul(
                        Decimal.from(currentPrice.toNumber()),
                    );
                    errorMessage += `⚠️ ${session.createGrid.symbol} shortfall: ${baseShortfall.toFixed(6)} (~${baseShortfallUsdc.toFixed(2)} USDC)\n`;
                }

                errorMessage += `\nPlease reduce your investment or add more funds.`;

                session.createGrid.showingValidationError = true;
                await this.messageManager.sendEnterMessage(ctx, errorMessage, keyboard);
                return null;
            }

            session.createGrid.totalInvestmentUSDC = investment;
            session.createGrid.upperPrice = upperPrice;
            session.createGrid.lowerPrice = lowerPrice;
            session.createGrid.levels = DEFAULT_LEVELS;
            session.createGrid.gridMode = GridMode.Neutral;

            return {
                nextStep: SceneStep.Preview,
                confirmations: [`✅ Investment set: ${investment} USDC`],
            };
        } catch (error) {
            await this.messageManager.sendEnterMessage(
                ctx,
                `❌ Failed to fetch data for ${session.createGrid.symbol}. Please try again later.`,
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
