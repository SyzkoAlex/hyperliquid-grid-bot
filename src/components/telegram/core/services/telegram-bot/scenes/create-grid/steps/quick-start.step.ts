import { replyWithKeyboard } from '../helpers/keyboard.helper';
import { BotContext } from '../../../types/bot-context';
import { InlineButton } from '../../../../../domain/inline-button';
import { CREATE_GRID_ACTIONS } from '../create-grid-actions';
import { HyperliquidInfoClient } from '@components/shared/secondary/clients/hyperliquid-info.client';
import { TradingSymbol } from '@domain/primitives/trading-symbol';

const MIN_INVESTMENT = 10;
const PRICE_RANGE_PERCENT = 20;
const DEFAULT_LEVELS = 10;

export class QuickStartStep {
    constructor(private readonly hyperliquidClient: HyperliquidInfoClient) {}

    async enter(ctx: BotContext): Promise<void> {
        const keyboard: InlineButton[][] = [
            [
                { text: '← Back', action: CREATE_GRID_ACTIONS.BACK },
                { text: '❌ Cancel', action: CREATE_GRID_ACTIONS.CANCEL },
            ],
        ];

        await replyWithKeyboard(
            ctx,
            `How much USDC do you want to invest?\n\nMinimum: ${MIN_INVESTMENT} USDC`,
            keyboard,
        );
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
            const price = await this.hyperliquidClient.getCurrentPrice(tradingSymbol);
            const currentPrice = price.toNumber();
            const priceOffset = currentPrice * (PRICE_RANGE_PERCENT / 100);

            session.createGrid.totalInvestmentUSDC = investment;
            session.createGrid.upperPrice = currentPrice + priceOffset;
            session.createGrid.lowerPrice = currentPrice - priceOffset;
            session.createGrid.levels = DEFAULT_LEVELS;

            await ctx.reply(
                `✅ Configuration:\n\n` +
                    `💰 Investment: ${investment} USDC\n` +
                    `📊 Price range: ${session.createGrid.lowerPrice.toFixed(4)} - ${session.createGrid.upperPrice.toFixed(4)}\n` +
                    `🎚 Levels: ${DEFAULT_LEVELS}\n` +
                    `💹 Current price: ${currentPrice.toFixed(4)}`,
            );

            return 'preview';
        } catch (error) {
            await ctx.reply(
                `❌ Failed to fetch current price for ${session.createGrid.symbol}. Please try again later.`,
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
        await ctx.reply('❌ Grid creation cancelled');
    }
}
