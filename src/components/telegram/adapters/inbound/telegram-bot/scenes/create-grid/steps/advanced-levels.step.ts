import { Injectable } from '@nestjs/common';
import { BotContext } from '../../../types/bot-context';
import { InlineButton } from '@components/telegram/core/domain/models/inline-button';
import { CREATE_GRID_ACTIONS, buildLevelsAction } from '../create-grid-actions';
import { WizardStep } from '../wizard/wizard-step';
import { SceneStep } from '../create-grid-scene-step';
import { StepResult } from '../wizard/step-result';
import { WizardMessageManager } from '../wizard/wizard-message-manager';
import { WIZARD_CONFIG } from '@components/telegram/core/domain/models/constants/wizard-config';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels.constants';
import { AdvancedLevelsMessages } from '@components/telegram/core/domain/models/messages/wizard/advanced-levels.messages';
import { ValidationMessages } from '@components/telegram/core/domain/models/messages/wizard/validation.messages';

@Injectable()
export class AdvancedLevelsStep implements WizardStep {
    readonly id = SceneStep.Levels;

    constructor(private readonly messageManager: WizardMessageManager) {}

    async enter(ctx: BotContext): Promise<void> {
        const keyboard: InlineButton[][] = [
            ...WIZARD_CONFIG.PRESET_LEVELS.map((level) => [
                { text: level.toString(), action: buildLevelsAction(level) },
            ]),
            [
                { text: BUTTON_LABELS.BACK, action: CREATE_GRID_ACTIONS.BACK },
                { text: BUTTON_LABELS.CANCEL, action: CREATE_GRID_ACTIONS.CANCEL },
            ],
        ];

        await this.messageManager.sendEnterMessage(ctx, AdvancedLevelsMessages.PROMPT, keyboard);
    }

    async handleLevelsSelection(ctx: BotContext, levels: number): Promise<StepResult> {
        const session = ctx.session;
        if (!session.createGrid?.lowerPrice) {
            return null;
        }

        if (levels < WIZARD_CONFIG.MIN_LEVELS || levels > WIZARD_CONFIG.MAX_LEVELS) {
            await this.messageManager.sendEnterMessage(
                ctx,
                ValidationMessages.invalidLevelsRange(
                    WIZARD_CONFIG.MIN_LEVELS,
                    WIZARD_CONFIG.MAX_LEVELS,
                ),
            );
            return null;
        }

        session.createGrid.levels = levels;
        return {
            nextStep: SceneStep.Investment,
            confirmations: [AdvancedLevelsMessages.confirmation(levels)],
        };
    }

    async handleTextInput(ctx: BotContext, text: string): Promise<StepResult> {
        const session = ctx.session;
        if (!session.createGrid?.lowerPrice) {
            return null;
        }

        const levels = parseInt(text, 10);

        if (isNaN(levels)) {
            await this.messageManager.sendEnterMessage(ctx, ValidationMessages.invalidNumber());
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
