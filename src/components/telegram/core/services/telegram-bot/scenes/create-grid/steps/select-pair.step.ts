import { replyWithKeyboard } from '../helpers/keyboard.helper';
import { BotContext } from '../../../types/bot-context';
import { InlineButton } from '../../../../../domain/inline-button';
import { HyperliquidInfoClient } from '@components/shared/secondary/clients/hyperliquid-info.client';
import { TradingSymbol } from '@domain/primitives/trading-symbol';
import { CREATE_GRID_ACTIONS, buildPairAction } from '../create-grid-actions';

const POPULAR_PAIRS = ['HYPE', 'BTC', 'ETH', 'SOL'];

export class SelectPairStep {
    constructor(private readonly hyperliquidClient: HyperliquidInfoClient) {}

    async enter(ctx: BotContext): Promise<void> {
        const keyboard: InlineButton[][] = [
            ...POPULAR_PAIRS.map((pair) => [{ text: pair, action: buildPairAction(pair) }]),
            [{ text: '🔍 Other pair', action: CREATE_GRID_ACTIONS.OTHER_PAIR }],
            [{ text: '❌ Cancel', action: CREATE_GRID_ACTIONS.CANCEL }],
        ];

        await replyWithKeyboard(ctx, 'Select trading pair:', keyboard);
    }

    async handlePairSelection(ctx: BotContext, symbol: string): Promise<'mode' | 'invalid'> {
        try {
            const tradingSymbol = TradingSymbol.fromString(symbol);
            const exists = await this.hyperliquidClient.pairExists(tradingSymbol);

            if (!exists) {
                await ctx.reply(`❌ Pair ${symbol} not found. Please try another symbol.`);
                return 'invalid';
            }

            ctx.session.createGrid = { symbol };
            await ctx.reply(`✅ Selected: ${symbol}`);
            return 'mode';
        } catch (error) {
            await ctx.reply(`❌ Invalid symbol format. Please try another symbol.`);
            return 'invalid';
        }
    }

    async handleOtherPair(ctx: BotContext): Promise<void> {
        await ctx.reply('Enter trading pair symbol (e.g., HYPE, BTC, ETH):');
    }

    async handleTextInput(ctx: BotContext, text: string): Promise<'mode' | 'invalid' | null> {
        const session = ctx.session;
        if (!session.createGrid) {
            return null;
        }

        const symbol = text.trim().toUpperCase();
        return await this.handlePairSelection(ctx, symbol);
    }

    async handleCancel(ctx: BotContext): Promise<void> {
        await ctx.scene.leave();
        await ctx.reply('❌ Grid creation cancelled');
    }
}
