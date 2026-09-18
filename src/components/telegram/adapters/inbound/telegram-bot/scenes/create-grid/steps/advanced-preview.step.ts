import { Injectable } from '@nestjs/common';
import { BotContext } from '../../../types/bot-context';
import { InlineButton } from '@components/telegram/core/domain/models/inline-button';
import { CREATE_GRID_ACTIONS } from '../create-grid-actions';
import { WizardStep } from '../wizard/wizard-step';
import { SceneStep } from '../create-grid-scene-step';
import { StepView } from '../wizard/step-view';
import { CreateGridMode } from '../create-grid-mode';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels';
import { AdvancedPreviewMessage } from '@components/telegram/core/domain/models/messages/wizard/advanced-preview.messages';
import { ValidationTexts } from '@components/telegram/core/domain/models/messages/wizard/validation.texts';

@Injectable()
export class AdvancedPreviewStep implements WizardStep {
    readonly id = SceneStep.Preview;

    async buildView(ctx: BotContext): Promise<StepView> {
        if (!this.validateState(ctx)) {
            return {
                body: ValidationTexts.invalidState(),
                keyboard: [
                    [
                        { text: BUTTON_LABELS.BACK, action: CREATE_GRID_ACTIONS.BACK },
                        { text: BUTTON_LABELS.CANCEL, action: CREATE_GRID_ACTIONS.CANCEL },
                    ],
                ],
            };
        }

        const state = ctx.session.createGrid!;
        const lowerPrice = state.lowerPrice!;
        const upperPrice = state.upperPrice!;
        const orderCount = state.orderCount!;
        const totalInvestment = state.totalInvestmentUSDC!;

        const keyboard: InlineButton[][] = [
            [{ text: BUTTON_LABELS.CONFIRM, action: CREATE_GRID_ACTIONS.CONFIRM }],
            [
                { text: BUTTON_LABELS.BACK, action: CREATE_GRID_ACTIONS.BACK },
                { text: BUTTON_LABELS.CANCEL, action: CREATE_GRID_ACTIONS.CANCEL },
            ],
        ];

        const body = AdvancedPreviewMessage.create({
            totalInvestment,
            orderCount,
            lowerPrice,
            upperPrice,
            capacityMax: state.balanceSnapshot?.suggestedMax,
        }).text;

        return { body, keyboard };
    }

    private validateState(ctx: BotContext): boolean {
        const state = ctx.session.createGrid;
        return !!(
            state?.symbol &&
            state?.mode &&
            state?.upperPrice &&
            state?.lowerPrice &&
            state?.orderCount &&
            state?.totalInvestmentUSDC
        );
    }

    rollbackState(ctx: BotContext): void {
        const session = ctx.session;
        const state = session.createGrid;
        if (!state) {
            return;
        }

        if (state.mode !== CreateGridMode.Advanced) {
            delete state.totalInvestmentUSDC;
            delete state.upperPrice;
            delete state.lowerPrice;
            delete state.orderCount;
            // aiSuggestion is intentionally kept — Back from Preview re-renders the AI step
            // from the cached suggestion without a seconds-scale re-fetch.
        } else {
            delete state.totalInvestmentUSDC;
        }
    }
}
