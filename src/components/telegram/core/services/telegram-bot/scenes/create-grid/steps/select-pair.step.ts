import { Injectable } from '@nestjs/common';
import { replyWithKeyboard } from '../helpers/keyboard.helper';
import { BotContext } from '../../../types/bot-context';
import { InlineButton } from '../../../../../domain/inline-button';
import { HyperliquidInfoClient } from '@components/shared/secondary/clients/hyperliquid-info.client';
import { TradingSymbol } from '@domain/primitives/trading-symbol';
import { CREATE_GRID_ACTIONS, buildPairAction } from '../create-grid-actions';
import { logger } from '@infra/logger/logger';

const POPULAR_TOKENS = ['HYPE', 'BTC', 'ETH', 'SOL'];

@Injectable()
export class SelectPairStep {
    constructor(private readonly hyperliquidClient: HyperliquidInfoClient) {}

    async enter(ctx: BotContext): Promise<void> {
        const keyboard: InlineButton[][] = [
            ...POPULAR_TOKENS.map((token) => [{ text: token, action: buildPairAction(token) }]),
            [{ text: '🔍 Other token', action: CREATE_GRID_ACTIONS.OTHER_PAIR }],
            [{ text: '❌ Cancel', action: CREATE_GRID_ACTIONS.CANCEL }],
        ];

        await replyWithKeyboard(ctx, 'Select token (all pairs trade against USDC):', keyboard);
    }

    async handlePairSelection(ctx: BotContext, symbol: string): Promise<'mode' | 'invalid'> {
        try {
            const tradingSymbol = TradingSymbol.fromString(symbol);
            const exists = await this.hyperliquidClient.pairExists(tradingSymbol);

            if (!exists) {
                await ctx.reply(`❌ Token ${symbol} not found. Please try another token.`);
                return 'invalid';
            }

            const messageIds = ctx.session.createGrid?.messageIds || [];
            if (messageIds.length > 0) {
                const tokenSelectionMessageId = messageIds.pop();
                if (tokenSelectionMessageId) {
                    try {
                        await ctx.deleteMessage(tokenSelectionMessageId);
                    } catch (error) {
                        logger.warn(
                            { error, messageId: tokenSelectionMessageId },
                            'Failed to delete token selection message',
                        );
                    }
                }
            }

            ctx.session.createGrid = {
                symbol,
                messageIds: messageIds.length > 0 ? messageIds : undefined,
            };
            await replyWithKeyboard(ctx, `✅ Selected: ${symbol}/USDC`);
            return 'mode';
        } catch (error) {
            await ctx.reply(`❌ Invalid token format. Please try another token.`);
            return 'invalid';
        }
    }

    async handleOtherPair(ctx: BotContext): Promise<void> {
        await ctx.reply('Enter token symbol (e.g., HYPE, BTC, ETH):');
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
    }
}
