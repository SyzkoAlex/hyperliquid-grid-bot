import { WizardContext } from '../../../../../core/domain/wizard-context';
import { InlineButton } from '../../../../../core/domain/inline-button';

const BACK_ACTION = 'create_grid:back';
const CANCEL_ACTION = 'create_grid:cancel';

export class AdvancedLowerStep {
    async enter(ctx: WizardContext): Promise<void> {
        const keyboard: InlineButton[][] = [
            [
                { text: '← Back', action: BACK_ACTION },
                { text: '❌ Cancel', action: CANCEL_ACTION },
            ],
        ];

        const session = ctx.getSession();
        let message = 'Enter lower price for the grid:';
        if (session.createGrid?.upperPrice) {
            message += `\n\nUpper price: ${session.createGrid.upperPrice.toFixed(4)}`;
        }

        await ctx.reply(message, keyboard);
    }

    async handlePriceInput(ctx: WizardContext, text: string): Promise<'levels' | 'invalid' | null> {
        const session = ctx.getSession();
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

    async handleBack(ctx: WizardContext): Promise<void> {
        const session = ctx.getSession();
        if (session.createGrid) {
            delete session.createGrid.upperPrice;
        }
    }

    async handleCancel(ctx: WizardContext): Promise<void> {
        await ctx.leaveScene();
        await ctx.reply('❌ Grid creation cancelled');
    }
}
