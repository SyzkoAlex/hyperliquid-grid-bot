import { WizardContext } from '../../../../../core/domain/wizard-context';
import { InlineButton } from '../../../../../core/domain/inline-button';
import { CreateGridMode } from '../../../../../core/domain/grid-mode';

const QUICK_MODE_ACTION = 'create_grid:mode:quick';
const ADVANCED_MODE_ACTION = 'create_grid:mode:advanced';
const BACK_ACTION = 'create_grid:back';
const CANCEL_ACTION = 'create_grid:cancel';

export class SelectModeStep {
    async enter(ctx: WizardContext): Promise<void> {
        const keyboard: InlineButton[][] = [
            [{ text: '⚡️ Quick start', action: QUICK_MODE_ACTION }],
            [{ text: '⚙️ Advanced', action: ADVANCED_MODE_ACTION }],
            [
                { text: '← Back', action: BACK_ACTION },
                { text: '❌ Cancel', action: CANCEL_ACTION },
            ],
        ];

        await ctx.reply(
            '⚡️ <b>Quick start</b>: Auto-configuration with ±20% price range and 10 levels\n' +
                '⚙️ <b>Advanced</b>: Manual configuration of all parameters',
            keyboard,
            'HTML',
        );
    }

    async handleModeSelection(ctx: WizardContext, mode: CreateGridMode): Promise<string> {
        const session = ctx.getSession();
        if (!session.createGrid) {
            session.createGrid = {};
        }
        session.createGrid.mode = mode;

        if (mode === CreateGridMode.Quick) {
            await ctx.reply('✅ Quick start mode selected');
            return 'quick';
        } else {
            await ctx.reply('✅ Advanced mode selected');
            return 'advanced';
        }
    }

    async handleBack(ctx: WizardContext): Promise<void> {
        const session = ctx.getSession();
        if (session.createGrid) {
            delete session.createGrid.mode;
        }
    }

    async handleCancel(ctx: WizardContext): Promise<void> {
        await ctx.leaveScene();
        await ctx.reply('❌ Grid creation cancelled');
    }
}
