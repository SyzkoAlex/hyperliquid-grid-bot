import { Injectable } from '@nestjs/common';
import { BotContext } from '../../../types/bot-context';
import { InlineButton } from '../../../../../domain/inline-button';
import { CreateGridMode } from '../create-grid-mode';
import { CREATE_GRID_ACTIONS } from '../create-grid-actions';
import { WizardStep } from '../wizard/wizard-step';
import { SceneStep } from '../create-grid-scene-step';
import { StepResult } from '../wizard/step-result';
import { WizardMessageManager } from '../wizard/wizard-message-manager';

@Injectable()
export class SelectModeStep implements WizardStep {
    readonly id = SceneStep.Mode;

    constructor(private readonly messageManager: WizardMessageManager) {}

    async enter(ctx: BotContext): Promise<void> {
        const keyboard: InlineButton[][] = [
            [{ text: '⚡️ Quick start', action: CREATE_GRID_ACTIONS.MODE_QUICK }],
            [{ text: '⚙️ Advanced', action: CREATE_GRID_ACTIONS.MODE_ADVANCED }],
            [
                { text: '← Back', action: CREATE_GRID_ACTIONS.BACK },
                { text: '❌ Cancel', action: CREATE_GRID_ACTIONS.CANCEL },
            ],
        ];

        await this.messageManager.sendEnterMessage(
            ctx,
            '⚡️ <b>Quick start</b>: Auto-configuration with ±20% price range and 10 levels\n' +
                '⚙️ <b>Advanced</b>: Manual configuration of all parameters',
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
                ? '✅ Quick start mode selected'
                : '✅ Advanced mode selected';
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
