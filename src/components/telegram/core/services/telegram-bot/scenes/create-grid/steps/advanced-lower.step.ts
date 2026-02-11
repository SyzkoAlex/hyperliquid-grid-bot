import { replyWithKeyboard } from '../helpers/keyboard.helper';
import { BotContext } from '../../../types/bot-context';
import { InlineButton } from '../../../../../domain/inline-button';
import { CREATE_GRID_ACTIONS } from '../create-grid-actions';

export class AdvancedLowerStep {
    async enter(ctx: BotContext): Promise<void> {
        const keyboard: InlineButton[][] = [
            [
                { text: '← Back', action: CREATE_GRID_ACTIONS.BACK },
                { text: '❌ Cancel', action: CREATE_GRID_ACTIONS.CANCEL },
            ],
        ];

        const session = ctx.session;
        let message = 'Enter lower price for the grid:';
        if (session.createGrid?.upperPrice) {
            message += `\n\nUpper price: ${session.createGrid.upperPrice.toFixed(4)}`;
        }

        await replyWithKeyboard(ctx, message, keyboard);
    }

    async handlePriceInput(ctx: BotContext, text: string): Promise<'levels' | 'invalid' | null> {
        const session = ctx.session;
        if (!session.createGrid?.upperPrice) {
            return null;
        }

        const price = parseFloat(text);

        if (isNaN(price) || price <= 0) {
            await ctx.reply('❌ Invalid price. Please enter a positive number:');
            return 'invalid';
        }

        if (price >= session.createGrid.upperPrice) {
            await ctx.reply(
                `❌ Lower price must be less than upper price (${session.createGrid.upperPrice.toFixed(4)})\n\nPlease enter a valid price:`,
            );
            return 'invalid';
        }

        session.createGrid.lowerPrice = price;
        await ctx.reply(`✅ Lower price set: ${price.toFixed(4)}`);
        return 'levels';
    }

    async handleBack(ctx: BotContext): Promise<void> {
        const session = ctx.session;
        if (session.createGrid) {
            delete session.createGrid.upperPrice;
        }
    }

    async handleCancel(ctx: BotContext): Promise<void> {
        await ctx.scene.leave();
        await ctx.reply('❌ Grid creation cancelled');
    }
}
