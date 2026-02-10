import { WizardContext } from '../../../../../core/domain/wizard-context';
import { InlineButton } from '../../../../../core/domain/inline-button';

const MIN_INVESTMENT = 10;

const BACK_ACTION = 'create_grid:back';
const CANCEL_ACTION = 'create_grid:cancel';

export class AdvancedInvestmentStep {
    async enter(ctx: WizardContext): Promise<void> {
        const keyboard: InlineButton[][] = [
            [
                { text: '← Back', action: BACK_ACTION },
                { text: '❌ Cancel', action: CANCEL_ACTION },
            ],
        ];

        await ctx.reply(
            `How much USDC do you want to invest?\n\nMinimum: ${MIN_INVESTMENT} USDC`,
            keyboard,
        );
    }

    async handleInvestmentInput(
        ctx: WizardContext,
        text: string,
    ): Promise<'preview' | 'invalid' | null> {
        const session = ctx.getSession();
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

    async handleBack(ctx: WizardContext): Promise<void> {
        const session = ctx.getSession();
        if (session.createGrid) {
            delete session.createGrid.levels;
        }
    }

    async handleCancel(ctx: WizardContext): Promise<void> {
        await ctx.leaveScene();
        await ctx.reply('❌ Grid creation cancelled');
    }
}
