import { Injectable } from '@nestjs/common';
import { BotContext } from '../../../types/bot-context';
import { InlineButton } from '@components/telegram/core/domain/models/inline-button';
import { CREATE_GRID_ACTIONS, buildOrdersAction } from '../create-grid-actions';
import { WizardStep } from '../wizard/wizard-step';
import { SceneStep } from '../create-grid-scene-step';
import { StepResult } from '../wizard/step-result';
import { StepView } from '../wizard/step-view';
import { WIZARD_CONFIG } from '@components/telegram/core/domain/models/constants/wizard-config';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels';
import { AdvancedOrdersTexts } from '@components/telegram/core/domain/models/messages/wizard/advanced-orders.messages';
import { ValidationTexts } from '@components/telegram/core/domain/models/messages/wizard/validation.texts';

@Injectable()
export class AdvancedOrdersStep implements WizardStep {
    readonly id = SceneStep.Orders;

    async buildView(_ctx: BotContext): Promise<StepView> {
        const keyboard: InlineButton[][] = [
            ...WIZARD_CONFIG.PRESET_ORDERS.map((orderCount) => [
                { text: orderCount.toString(), action: buildOrdersAction(orderCount) },
            ]),
            [
                { text: BUTTON_LABELS.BACK, action: CREATE_GRID_ACTIONS.BACK },
                { text: BUTTON_LABELS.CANCEL, action: CREATE_GRID_ACTIONS.CANCEL },
            ],
        ];

        return { body: AdvancedOrdersTexts.PROMPT, keyboard };
    }

    async handleOrdersSelection(ctx: BotContext, orderCount: number): Promise<StepResult> {
        const session = ctx.session;
        if (!session.createGrid?.lowerPrice) {
            return null;
        }

        if (orderCount < WIZARD_CONFIG.MIN_ORDERS || orderCount > WIZARD_CONFIG.MAX_ORDERS) {
            session.createGrid.pendingError = ValidationTexts.invalidOrdersRange(
                WIZARD_CONFIG.MIN_ORDERS,
                WIZARD_CONFIG.MAX_ORDERS,
            );
            return null;
        }

        session.createGrid.orderCount = orderCount;
        return { nextStep: SceneStep.Investment };
    }

    async handleTextInput(ctx: BotContext, text: string): Promise<StepResult> {
        const session = ctx.session;
        if (!session.createGrid?.lowerPrice) {
            return null;
        }

        const orderCount = parseInt(text, 10);

        if (isNaN(orderCount)) {
            session.createGrid.pendingError = ValidationTexts.invalidNumber();
            return null;
        }

        return this.handleOrdersSelection(ctx, orderCount);
    }

    rollbackState(ctx: BotContext): void {
        if (ctx.session.createGrid) {
            delete ctx.session.createGrid.orderCount;
        }
    }
}
