import { Injectable } from '@nestjs/common';
import { BotContext } from '../../../types/bot-context';
import { InlineButton } from '@components/telegram/domain/models/inline-button';
import { CreateGridMode } from '../create-grid-mode';
import { CREATE_GRID_ACTIONS } from '../create-grid-actions';
import { WizardStep } from '../wizard/wizard-step';
import { SceneStep } from '../create-grid-scene-step';
import { StepResult } from '../wizard/step-result';
import { WizardMessageManager } from '../wizard/wizard-message-manager';
import { BUTTON_LABELS } from '@components/telegram/domain/models/constants/button-labels.constants';
import { SelectModeMessages } from '@components/telegram/domain/models/messages/wizard/select-mode.messages';

@Injectable()
export class SelectModeStep implements WizardStep {
    readonly id = SceneStep.Mode;

    constructor(private readonly messageManager: WizardMessageManager) {}

    async enter(ctx: BotContext): Promise<void> {
        const keyboard: InlineButton[][] = [
            [{ text: BUTTON_LABELS.MODE_QUICK, action: CREATE_GRID_ACTIONS.MODE_QUICK }],
            [{ text: BUTTON_LABELS.MODE_ADVANCED, action: CREATE_GRID_ACTIONS.MODE_ADVANCED }],
            [
                { text: BUTTON_LABELS.BACK, action: CREATE_GRID_ACTIONS.BACK },
                { text: BUTTON_LABELS.CANCEL, action: CREATE_GRID_ACTIONS.CANCEL },
            ],
        ];

        await this.messageManager.sendEnterMessage(
            ctx,
            SelectModeMessages.PROMPT,
            keyboard,
            'HTML',
        );
    }

    async handleModeSelection(ctx: BotContext, mode: CreateGridMode): Promise<StepResult> {
        const session = ctx.session;
        if (!session.createGrid) {
            session.createGrid = {};
        }
        session.createGrid.mode = mode;

        const confirmText =
            mode === CreateGridMode.Quick
                ? SelectModeMessages.QUICK_MODE_CONFIRMATION
                : SelectModeMessages.ADVANCED_MODE_CONFIRMATION;
        const nextStep = mode === CreateGridMode.Quick ? SceneStep.Quick : SceneStep.Upper;

        return {
            nextStep,
            confirmations: [confirmText],
        };
    }

    rollbackState(ctx: BotContext): void {
        if (ctx.session.createGrid) {
            delete ctx.session.createGrid.mode;
        }
    }
}
