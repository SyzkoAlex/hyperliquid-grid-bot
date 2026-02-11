import { replyWithKeyboard } from '../helpers/keyboard.helper';
import { BotContext } from '../../../types/bot-context';
import { InlineButton } from '../../../../../domain/inline-button';
import { CREATE_GRID_ACTIONS } from '../create-grid-actions';

export class AdvancedPreviewStep {
    async enter(ctx: BotContext): Promise<void> {
        if (!this.validateState(ctx)) {
            await replyWithKeyboard(ctx, '❌ Invalid state. Please start over.');
            await ctx.scene.leave();
            return;
        }

        const session = ctx.session;
        const state = session.createGrid!;
        const orderSize =
            state.totalInvestmentUSDC && state.levels
                ? (state.totalInvestmentUSDC / state.levels).toFixed(2)
                : 'N/A';

        const keyboard: InlineButton[][] = [
            [{ text: '✅ Confirm', action: CREATE_GRID_ACTIONS.CONFIRM }],
            [
                { text: '← Back', action: CREATE_GRID_ACTIONS.BACK },
                { text: '❌ Cancel', action: CREATE_GRID_ACTIONS.CANCEL },
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

        await replyWithKeyboard(ctx, message, keyboard, 'HTML');
    }

    private validateState(ctx: BotContext): boolean {
        const session = ctx.session;
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

    async handleConfirm(_ctx: BotContext): Promise<'confirm'> {
        return 'confirm';
    }

    async handleBack(ctx: BotContext): Promise<void> {
        const session = ctx.session;
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

    async handleCancel(ctx: BotContext): Promise<void> {
        await ctx.scene.leave();
        await replyWithKeyboard(ctx, '❌ Grid creation cancelled');
    }
}
