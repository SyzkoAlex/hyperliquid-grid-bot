import { Injectable } from '@nestjs/common';
import { BotContext } from '../../../types/bot-context';
import { InlineButton } from '../../../../../domain/inline-button';
import { CREATE_GRID_ACTIONS, buildLevelsAction } from '../create-grid-actions';
import { WizardStep } from '../wizard/wizard-step';
import { SceneStep } from '../create-grid-scene-step';
import { StepResult } from '../wizard/step-result';
import { WizardMessageManager } from '../wizard/wizard-message-manager';

const MIN_LEVELS = 3;
const MAX_LEVELS = 100;
const PRESET_LEVELS = [5, 10, 20, 50];

@Injectable()
export class AdvancedLevelsStep implements WizardStep {
    readonly id = SceneStep.Levels;

    constructor(private readonly messageManager: WizardMessageManager) {}

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

        await this.messageManager.sendEnterMessage(
            ctx,
            `How many grid levels?\n\nSelect preset or enter custom value (${MIN_LEVELS}-${MAX_LEVELS}):`,
            keyboard,
        );
    }

    async handleLevelsSelection(ctx: BotContext, levels: number): Promise<StepResult> {
        const session = ctx.session;
        if (!session.createGrid?.lowerPrice) {
            return null;
        }

        if (levels < MIN_LEVELS || levels > MAX_LEVELS) {
            await this.messageManager.sendEnterMessage(
                ctx,
                `❌ Invalid number of levels. Must be between ${MIN_LEVELS} and ${MAX_LEVELS}`,
            );
            return null;
        }

        session.createGrid.levels = levels;
        return {
            nextStep: SceneStep.Investment,
            confirmations: [`✅ Grid levels set: ${levels}`],
        };
    }

    async handleTextInput(ctx: BotContext, text: string): Promise<StepResult> {
        const session = ctx.session;
        if (!session.createGrid?.lowerPrice) {
            return null;
        }

        const levels = parseInt(text, 10);

        if (isNaN(levels)) {
            await this.messageManager.sendEnterMessage(
                ctx,
                '❌ Invalid input. Please enter a number:',
            );
            return null;
        }

        return await this.handleLevelsSelection(ctx, levels);
    }

    rollbackState(ctx: BotContext): void {
        if (ctx.session.createGrid) {
            delete ctx.session.createGrid.levels;
        }
    }
}
