import { WizardContext } from '../../../../../core/domain/wizard-context';
import { InlineButton } from '../../../../../core/domain/inline-button';

const MIN_LEVELS = 3;
const MAX_LEVELS = 100;
const PRESET_LEVELS = [5, 10, 20, 50];

const BACK_ACTION = 'create_grid:back';
const CANCEL_ACTION = 'create_grid:cancel';

export class AdvancedLevelsStep {
    async enter(ctx: WizardContext): Promise<void> {
        const keyboard: InlineButton[][] = [
            ...PRESET_LEVELS.map((level) => [
                { text: level.toString(), action: `create_grid:levels:${level}` },
            ]),
            [
                { text: '← Back', action: BACK_ACTION },
                { text: '❌ Cancel', action: CANCEL_ACTION },
            ],
        ];

        await ctx.reply(
            `How many grid levels?\n\nSelect preset or enter custom value (${MIN_LEVELS}-${MAX_LEVELS}):`,
            keyboard,
        );
    }

    async handleLevelsSelection(
        ctx: WizardContext,
        levels: number,
    ): Promise<'investment' | 'invalid' | null> {
        const session = ctx.getSession();
        if (!session.createGrid?.lowerPrice) {
            return null;
        }

        if (levels < MIN_LEVELS || levels > MAX_LEVELS) {
            await ctx.reply(
                `❌ Invalid number of levels. Must be between ${MIN_LEVELS} and ${MAX_LEVELS}`,
            );
            return 'invalid';
        }

        session.createGrid.levels = levels;
        await ctx.reply(`✅ Grid levels set: ${levels}`);
        return 'investment';
    }

    async handleTextInput(
        ctx: WizardContext,
        text: string,
    ): Promise<'investment' | 'invalid' | null> {
        const session = ctx.getSession();
        if (!session.createGrid?.lowerPrice) {
            return null;
        }

        const levels = parseInt(text, 10);

        if (isNaN(levels)) {
            await ctx.reply('❌ Invalid input. Please enter a number:');
            return 'invalid';
        }

        return await this.handleLevelsSelection(ctx, levels);
    }

    async handleBack(ctx: WizardContext): Promise<void> {
        const session = ctx.getSession();
        if (session.createGrid) {
            delete session.createGrid.lowerPrice;
        }
    }

    async handleCancel(ctx: WizardContext): Promise<void> {
        await ctx.leaveScene();
        await ctx.reply('❌ Grid creation cancelled');
    }
}
