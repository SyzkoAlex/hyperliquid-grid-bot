import { WizardContext } from '../../../../../core/domain/wizard-context';
import { InlineButton } from '../../../../../core/domain/inline-button';

const CONFIRM_ACTION = 'create_grid:confirm';
const BACK_ACTION = 'create_grid:back';
const CANCEL_ACTION = 'create_grid:cancel';

export class AdvancedPreviewStep {
    async enter(ctx: WizardContext): Promise<void> {
        if (!this.validateState(ctx)) {
            await ctx.reply('❌ Invalid state. Please start over.');
            await ctx.leaveScene();
            return;
        }

        const session = ctx.getSession();
        const state = session.createGrid!;
        const orderSize =
            state.totalInvestmentUSDC && state.levels
                ? (state.totalInvestmentUSDC / state.levels).toFixed(2)
                : 'N/A';

        const keyboard: InlineButton[][] = [
            [{ text: '✅ Confirm', action: CONFIRM_ACTION }],
            [
                { text: '← Back', action: BACK_ACTION },
                { text: '❌ Cancel', action: CANCEL_ACTION },
            ],
        ];

        const message =
            `<b>📋 Grid Configuration Preview</b>\n\n` +
            `🔸 Symbol: ${state.symbol}\n` +
            `🔸 Mode: ${state.mode}\n` +
            `🔸 Price Range: ${state.lowerPrice?.toFixed(4)} - ${state.upperPrice?.toFixed(4)}\n` +
            `🔸 Levels: ${state.levels}\n` +
            `🔸 Investment: ${state.totalInvestmentUSDC} USDC\n` +
            `🔸 Order Size: ~${orderSize} USDC per level\n\n` +
            `Ready to create grid?`;

        await ctx.reply(message, keyboard, 'HTML');
    }

    private validateState(ctx: WizardContext): boolean {
        const session = ctx.getSession();
        const state = session.createGrid;
        return !!(
            state?.symbol &&
            state?.mode &&
            state?.upperPrice &&
            state?.lowerPrice &&
            state?.levels &&
            state?.totalInvestmentUSDC
        );
    }

    async handleConfirm(_ctx: WizardContext): Promise<'confirm'> {
        return 'confirm';
    }

    async handleBack(ctx: WizardContext): Promise<void> {
        const session = ctx.getSession();
        const state = session.createGrid;
        if (!state) {
            return;
        }

        if (state.mode === 'quick') {
            delete state.totalInvestmentUSDC;
            delete state.upperPrice;
            delete state.lowerPrice;
            delete state.levels;
        } else {
            delete state.totalInvestmentUSDC;
        }
    }

    async handleCancel(ctx: WizardContext): Promise<void> {
        await ctx.leaveScene();
        await ctx.reply('❌ Grid creation cancelled');
    }
}
