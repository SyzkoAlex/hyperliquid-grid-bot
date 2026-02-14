import { replyWithKeyboard } from '../helpers/keyboard.helper';
import { BotContext } from '../../../types/bot-context';
import { InlineButton } from '../../../../../domain/inline-button';
import { CREATE_GRID_ACTIONS, buildLevelsAction } from '../create-grid-actions';

const MIN_LEVELS = 3;
const MAX_LEVELS = 100;
const PRESET_LEVELS = [5, 10, 20, 50];

export class AdvancedLevelsStep {
    async enter(ctx: BotContext): Promise<void> {
        const keyboard: InlineButton[][] = [
            ...PRESET_LEVELS.map((level) => [
                { text: level.toString(), action: buildLevelsAction(level) },
            ]),
            [
                { text: '← Back', action: CREATE_GRID_ACTIONS.BACK },
                { text: '❌ Cancel', action: CREATE_GRID_ACTIONS.CANCEL },
            ],
        ];

        await replyWithKeyboard(
            ctx,
            `How many grid levels?\n\nSelect preset or enter custom value (${MIN_LEVELS}-${MAX_LEVELS}):`,
            keyboard,
        );
    }

    async handleLevelsSelection(
        ctx: BotContext,
        levels: number,
    ): Promise<'investment' | 'invalid' | null> {
        const session = ctx.session;
        if (!session.createGrid?.lowerPrice) {
            return null;
        }

        if (levels < MIN_LEVELS || levels > MAX_LEVELS) {
            await replyWithKeyboard(
                ctx,
                `❌ Invalid number of levels. Must be between ${MIN_LEVELS} and ${MAX_LEVELS}`,
            );
            return 'invalid';
        }

        session.createGrid.levels = levels;
        await replyWithKeyboard(ctx, `✅ Grid levels set: ${levels}`);
        return 'investment';
    }

    async handleTextInput(ctx: BotContext, text: string): Promise<'investment' | 'invalid' | null> {
        const session = ctx.session;
        if (!session.createGrid?.lowerPrice) {
            return null;
        }

        const levels = parseInt(text, 10);

        if (isNaN(levels)) {
            await replyWithKeyboard(ctx, '❌ Invalid input. Please enter a number:');
            return 'invalid';
        }

        return await this.handleLevelsSelection(ctx, levels);
    }

    async handleBack(ctx: BotContext): Promise<void> {
        const session = ctx.session;
        if (session.createGrid) {
            delete session.createGrid.lowerPrice;
        }
    }

    async handleCancel(ctx: BotContext): Promise<void> {
        await ctx.scene.leave();
    }
}
