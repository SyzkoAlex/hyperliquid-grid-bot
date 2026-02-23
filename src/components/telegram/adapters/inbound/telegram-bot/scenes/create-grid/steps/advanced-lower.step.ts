import { Injectable } from '@nestjs/common';
import { BotContext } from '../../../types/bot-context';
import { InlineButton } from '@components/telegram/core/domain/models/inline-button';
import { CREATE_GRID_ACTIONS } from '../create-grid-actions';
import { WizardStep } from '../wizard/wizard-step';
import { SceneStep } from '../create-grid-scene-step';
import { StepResult } from '../wizard/step-result';
import { WizardMessageManager } from '../wizard/wizard-message-manager';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels.constants';
import { AdvancedLowerMessages } from '@components/telegram/core/domain/models/messages/wizard/advanced-lower.messages';
import { ValidationMessages } from '@components/telegram/core/domain/models/messages/wizard/validation.messages';

@Injectable()
export class AdvancedLowerStep implements WizardStep {
    readonly id = SceneStep.Lower;

    constructor(private readonly messageManager: WizardMessageManager) {}

    async enter(ctx: BotContext): Promise<void> {
        const keyboard: InlineButton[][] = [
            [
                { text: BUTTON_LABELS.BACK, action: CREATE_GRID_ACTIONS.BACK },
                { text: BUTTON_LABELS.CANCEL, action: CREATE_GRID_ACTIONS.CANCEL },
            ],
        ];

        const session = ctx.session;
        const message = AdvancedLowerMessages.prompt(session.createGrid?.upperPrice);

        await this.messageManager.sendEnterMessage(ctx, message, keyboard);
    }

    async handleTextInput(ctx: BotContext, text: string): Promise<StepResult> {
        const session = ctx.session;
        if (!session.createGrid?.upperPrice) {
            return null;
        }

        const price = parseFloat(text);

        if (isNaN(price) || price <= 0) {
            await this.messageManager.sendEnterMessage(ctx, ValidationMessages.invalidPrice());
            return null;
        }

        if (price >= session.createGrid.upperPrice) {
            await this.messageManager.sendEnterMessage(
                ctx,
                ValidationMessages.lowerPriceMustBeLess(session.createGrid.upperPrice),
            );
            return null;
        }

        session.createGrid.lowerPrice = price;
        return {
            nextStep: SceneStep.Levels,
            confirmations: [AdvancedLowerMessages.confirmation(price)],
        };
    }

    rollbackState(ctx: BotContext): void {
        if (ctx.session.createGrid) {
            delete ctx.session.createGrid.lowerPrice;
        }
    }
}
