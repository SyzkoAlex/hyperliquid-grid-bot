import { Injectable } from '@nestjs/common';
import { replyWithKeyboard } from '../helpers/keyboard.helper';
import { BotContext } from '../../../types/bot-context';
import { InlineButton } from '../../../../../domain/inline-button';
import { CREATE_GRID_ACTIONS } from '../create-grid-actions';
import { HyperliquidInfoClient } from '@components/shared/secondary/clients/hyperliquid-info.client';
import { TradingSymbol } from '@domain/primitives/trading-symbol';

@Injectable()
export class AdvancedUpperStep {
    constructor(private readonly hyperliquidClient: HyperliquidInfoClient) {}

    async enter(ctx: BotContext): Promise<void> {
        const keyboard: InlineButton[][] = [
            [
                { text: '← Back', action: CREATE_GRID_ACTIONS.BACK },
                { text: '❌ Cancel', action: CREATE_GRID_ACTIONS.CANCEL },
            ],
        ];

        const session = ctx.session;
        let message = 'Enter upper price for the grid:';
        if (session.createGrid?.symbol) {
            try {
                const tradingSymbol = TradingSymbol.fromString(session.createGrid.symbol);
                const price = await this.hyperliquidClient.getCurrentPrice(tradingSymbol);
                const currentPrice = price.toNumber();
                message += `\n\nCurrent ${session.createGrid.symbol} price: ${currentPrice.toFixed(4)}`;
            } catch (error) {
                message += `\n\n⚠️ Could not fetch current price`;
            }
        }

        await replyWithKeyboard(ctx, message, keyboard);
    }

    async handlePriceInput(ctx: BotContext, text: string): Promise<'lower' | 'invalid' | null> {
        const session = ctx.session;
        if (!session.createGrid) {
            return null;
        }

        const price = parseFloat(text);

        if (isNaN(price) || price <= 0) {
            await ctx.reply('❌ Invalid price. Please enter a positive number:');
            return 'invalid';
        }

        session.createGrid.upperPrice = price;
        await ctx.reply(`✅ Upper price set: ${price.toFixed(4)}`);
        return 'lower';
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
}
