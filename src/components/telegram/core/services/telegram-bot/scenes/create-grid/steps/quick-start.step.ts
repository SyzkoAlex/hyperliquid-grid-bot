import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { replyWithKeyboard } from '../helpers/keyboard.helper';
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

const MIN_INVESTMENT = 10;
const PRICE_RANGE_PERCENT = 20;
const DEFAULT_LEVELS = 10;

@Injectable()
export class QuickStartStep {
    private readonly accountAddress: string;

    constructor(
        private readonly hyperliquidClient: HyperliquidInfoClient,
        private readonly userBalanceExtractor: UserBalanceExtractorService,
        private readonly capitalCalculator: CapitalCalculatorService,
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

        let message = `How much USDC do you want to invest?\n\nMinimum: ${MIN_INVESTMENT} USDC`;

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

                message =
                    `💵 Your balance:\n` +
                    `  • USDC: ${usdcBalance.toString()}\n` +
                    `  • ${symbol}: ${baseBalance.toString()} (~${baseInUsdc.toFixed(2)} USDC)\n\n` +
                    `How much USDC do you want to invest?\n\n` +
                    `Minimum: ${MIN_INVESTMENT} USDC`;
            } catch (error) {
                logger.warn({ error }, 'Failed to fetch balance in quick start step');
            }
        }

        await replyWithKeyboard(ctx, message, keyboard);
    }

    async handleInvestmentInput(
        ctx: BotContext,
        text: string,
    ): Promise<'preview' | 'invalid' | null> {
        const session = ctx.session;
        if (!session.createGrid?.symbol) {
            return null;
        }

        const investment = parseFloat(text);

        if (isNaN(investment) || investment < MIN_INVESTMENT) {
            await ctx.reply(
                `❌ Invalid amount. Minimum investment: ${MIN_INVESTMENT} USDC\n\nPlease enter a valid amount:`,
            );
            return 'invalid';
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

            session.createGrid.totalInvestmentUSDC = investment;
            session.createGrid.upperPrice = upperPrice;
            session.createGrid.lowerPrice = lowerPrice;
            session.createGrid.levels = DEFAULT_LEVELS;

            const baseInUsdc = baseBalance.mul(Decimal.from(currentPrice.toNumber()));

            await this.deleteLastMessages(ctx, 1);

            await replyWithKeyboard(ctx, `✅ You are investing ${investment} USDC`);

            await replyWithKeyboard(
                ctx,
                `💵 Your balance:\n` +
                    `  • USDC: ${usdcBalance.toString()}\n` +
                    `  • ${session.createGrid.symbol}: ${baseBalance.toString()} (~${baseInUsdc.toFixed(2)} USDC)\n\n` +
                    `📈 Required for grid:\n` +
                    `  • USDC: ${distribution.investmentUSDC.toString()}\n` +
                    `  • ${session.createGrid.symbol}: ${distribution.investmentBase.toString()}`,
            );

            return 'preview';
        } catch (error) {
            await ctx.reply(
                `❌ Failed to fetch data for ${session.createGrid.symbol}. Please try again later.`,
            );
            return 'invalid';
        }
    }

    async handleBack(ctx: BotContext): Promise<void> {
        const session = ctx.session;
        if (session.createGrid) {
            delete session.createGrid.mode;
        }
    }

    async handleCancel(ctx: BotContext): Promise<void> {
        await ctx.scene.leave();
    }

    private async deleteLastMessages(ctx: BotContext, count: number): Promise<void> {
        const messageIds = ctx.session.createGrid?.messageIds;
        if (!messageIds || messageIds.length === 0) {
            return;
        }

        for (let i = 0; i < count && messageIds.length > 0; i++) {
            const messageId = messageIds.pop();
            if (messageId) {
                try {
                    await ctx.deleteMessage(messageId);
                } catch (error) {
                    logger.warn(
                        { error, messageId },
                        'Failed to delete message in quick start step',
                    );
                }
            }
        }
    }
}
