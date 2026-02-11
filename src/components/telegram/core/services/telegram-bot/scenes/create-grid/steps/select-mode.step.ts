import { replyWithKeyboard } from '../helpers/keyboard.helper';
import { BotContext } from '../../../types/bot-context';
import { InlineButton } from '../../../../../domain/inline-button';
import { CreateGridMode } from '../create-grid-mode';
import { CREATE_GRID_ACTIONS } from '../create-grid-actions';

export class SelectModeStep {
    async enter(ctx: BotContext): Promise<void> {
        const keyboard: InlineButton[][] = [
            [{ text: '⚡️ Quick start', action: CREATE_GRID_ACTIONS.MODE_QUICK }],
            [{ text: '⚙️ Advanced', action: CREATE_GRID_ACTIONS.MODE_ADVANCED }],
            [
                { text: '← Back', action: CREATE_GRID_ACTIONS.BACK },
                { text: '❌ Cancel', action: CREATE_GRID_ACTIONS.CANCEL },
            ],
        ];

        await replyWithKeyboard(
            ctx,
            '⚡️ <b>Quick start</b>: Auto-configuration with ±20% price range and 10 levels\n' +
                '⚙️ <b>Advanced</b>: Manual configuration of all parameters',
            keyboard,
            'HTML',
        );
    }

    async handleModeSelection(ctx: BotContext, mode: CreateGridMode): Promise<string> {
        const session = ctx.session;
        if (!session.createGrid) {
            session.createGrid = {};
        }
        session.createGrid.mode = mode;

        if (mode === CreateGridMode.Quick) {
            await replyWithKeyboard(ctx, '✅ Quick start mode selected');
            return 'quick';
        } else {
            await replyWithKeyboard(ctx, '✅ Advanced mode selected');
            return 'advanced';
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
        await replyWithKeyboard(ctx, '❌ Grid creation cancelled');
    }
}
