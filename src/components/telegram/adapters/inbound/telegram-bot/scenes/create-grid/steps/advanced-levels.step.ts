import { Injectable } from '@nestjs/common';
import { BotContext } from '../../../types/bot-context';
import { InlineButton } from '@components/telegram/core/domain/models/inline-button';
import { CREATE_GRID_ACTIONS, buildLevelsAction } from '../create-grid-actions';
import { WizardStep } from '../wizard/wizard-step';
import { SceneStep } from '../create-grid-scene-step';
import { StepResult } from '../wizard/step-result';
import { StepView } from '../wizard/step-view';
import { WIZARD_CONFIG } from '@components/telegram/core/domain/models/constants/wizard-config';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels';
import { AdvancedLevelsTexts } from '@components/telegram/core/domain/models/messages/wizard/advanced-levels.messages';
import { ValidationTexts } from '@components/telegram/core/domain/models/messages/wizard/validation.texts';

@Injectable()
export class AdvancedLevelsStep implements WizardStep {
    readonly id = SceneStep.Levels;

    async buildView(_ctx: BotContext): Promise<StepView> {
        const keyboard: InlineButton[][] = [
            ...WIZARD_CONFIG.PRESET_LEVELS.map((level) => [
                { text: level.toString(), action: buildLevelsAction(level) },
            ]),
            [
                { text: BUTTON_LABELS.BACK, action: CREATE_GRID_ACTIONS.BACK },
                { text: BUTTON_LABELS.CANCEL, action: CREATE_GRID_ACTIONS.CANCEL },
            ],
        ];

        return { body: AdvancedLevelsTexts.PROMPT, keyboard };
    }

    async handleLevelsSelection(ctx: BotContext, levels: number): Promise<StepResult> {
        const session = ctx.session;
        if (!session.createGrid?.lowerPrice) {
            return null;
        }

        if (levels < WIZARD_CONFIG.MIN_LEVELS || levels > WIZARD_CONFIG.MAX_LEVELS) {
            session.createGrid.pendingError = ValidationTexts.invalidLevelsRange(
                WIZARD_CONFIG.MIN_LEVELS,
                WIZARD_CONFIG.MAX_LEVELS,
            );
            return null;
        }

        session.createGrid.levels = levels;
        return { nextStep: SceneStep.Investment };
    }

    async handleTextInput(ctx: BotContext, text: string): Promise<StepResult> {
        const session = ctx.session;
        if (!session.createGrid?.lowerPrice) {
            return null;
        }

        const levels = parseInt(text, 10);

        if (isNaN(levels)) {
            session.createGrid.pendingError = ValidationTexts.invalidNumber();
            return null;
        }

        return this.handleLevelsSelection(ctx, levels);
    }

    rollbackState(ctx: BotContext): void {
        if (ctx.session.createGrid) {
            delete ctx.session.createGrid.levels;
        }
    }
}
