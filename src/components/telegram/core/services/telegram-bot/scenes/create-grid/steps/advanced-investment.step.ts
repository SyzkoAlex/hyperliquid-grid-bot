import { replyWithKeyboard } from '../helpers/keyboard.helper';
import { BotContext } from '../../../types/bot-context';
import { InlineButton } from '../../../../../domain/inline-button';
import { CREATE_GRID_ACTIONS } from '../create-grid-actions';

const MIN_INVESTMENT = 10;

export class AdvancedInvestmentStep {
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
        if (!session.createGrid?.levels) {
            return null;
        }

        const investment = parseFloat(text);

        if (isNaN(investment) || investment < MIN_INVESTMENT) {
            await ctx.reply(
                `❌ Invalid amount. Minimum investment: ${MIN_INVESTMENT} USDC\n\nPlease enter a valid amount:`,
            );
            return 'invalid';
        }

        session.createGrid.totalInvestmentUSDC = investment;
        await ctx.reply(`✅ Investment set: ${investment} USDC`);
        return 'preview';
    }

    async handleBack(ctx: BotContext): Promise<void> {
        const session = ctx.session;
        if (session.createGrid) {
            delete session.createGrid.levels;
        }
    }

    async handleCancel(ctx: BotContext): Promise<void> {
        await ctx.scene.leave();
    }
}
