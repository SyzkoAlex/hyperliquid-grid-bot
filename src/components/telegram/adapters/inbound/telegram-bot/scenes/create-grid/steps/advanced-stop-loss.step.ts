import { Injectable } from '@nestjs/common';
import { BotContext } from '../../../types/bot-context';
import { InlineButton } from '@components/telegram/core/domain/models/inline-button';
import { CREATE_GRID_ACTIONS } from '../create-grid-actions';
import { WizardStep } from '../wizard/wizard-step';
import { SceneStep } from '../create-grid-scene-step';
import { StepResult } from '../wizard/step-result';
import { WizardMessageManager } from '../wizard/wizard-message-manager';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels';
import { AdvancedStopLossPromptMessage } from '@components/telegram/core/domain/models/messages/wizard/advanced-stop-loss-prompt.message';
import { AdvancedStopLossConfirmationMessage } from '@components/telegram/core/domain/models/messages/wizard/advanced-stop-loss-confirmation.message';
import { ValidationTexts } from '@components/telegram/core/domain/models/messages/wizard/validation.texts';
import { TelegramParseMode } from '@components/telegram/core/domain/models/telegram-parse-mode';

@Injectable()
export class AdvancedStopLossStep implements WizardStep {
    /** Minimum relative distance from lower bound required for the SL price. */
    private static readonly MIN_BUFFER_FROM_LOWER = 0.005; // 0.5 %
    readonly id = SceneStep.StopLoss;

    constructor(private readonly messageManager: WizardMessageManager) {}

    async enter(ctx: BotContext): Promise<void> {
        const lowerPrice = ctx.session.createGrid?.lowerPrice;

        const keyboard: InlineButton[][] = [
            [{ text: '⏭ Skip (No SL)', action: CREATE_GRID_ACTIONS.STOP_LOSS_OFF }],
            [
                { text: BUTTON_LABELS.BACK, action: CREATE_GRID_ACTIONS.BACK },
                { text: BUTTON_LABELS.CANCEL, action: CREATE_GRID_ACTIONS.CANCEL },
            ],
        ];

        const message = AdvancedStopLossPromptMessage.create(lowerPrice).text;
        await this.messageManager.sendEnterMessage(ctx, message, keyboard, TelegramParseMode.HTML);
    }

    async handleTextInput(ctx: BotContext, text: string): Promise<StepResult> {
        const session = ctx.session;
        const lowerPrice = session.createGrid?.lowerPrice;

        if (!lowerPrice) {
            return null;
        }

        const price = parseFloat(text);

        if (isNaN(price) || price <= 0) {
            await this.messageManager.sendEnterMessage(
                ctx,
                ValidationTexts.stopLossMustBePositive(),
            );
            return null;
        }

        if (price >= lowerPrice) {
            await this.messageManager.sendEnterMessage(
                ctx,
                ValidationTexts.stopLossMustBeBelowLower(lowerPrice),
            );
            return null;
        }

        const maxAllowed = lowerPrice * (1 - AdvancedStopLossStep.MIN_BUFFER_FROM_LOWER);
        if (price > maxAllowed) {
            await this.messageManager.sendEnterMessage(
                ctx,
                ValidationTexts.stopLossTooCloseToLower(lowerPrice),
            );
            return null;
        }

        session.createGrid!.stopLossEnabled = true;
        session.createGrid!.stopLossPrice = price;

        return {
            nextStep: SceneStep.Preview,
            confirmations: [AdvancedStopLossConfirmationMessage.create(price).text],
        };
    }

    /** Called when the user taps Skip — disable SL and advance to preview. */
    async handleSkip(ctx: BotContext): Promise<StepResult> {
        const session = ctx.session;
        if (session.createGrid) {
            session.createGrid.stopLossEnabled = false;
            delete session.createGrid.stopLossPrice;
        }
        return { nextStep: SceneStep.Preview, confirmations: [] };
    }

    rollbackState(ctx: BotContext): void {
        if (ctx.session.createGrid) {
            delete ctx.session.createGrid.stopLossEnabled;
            delete ctx.session.createGrid.stopLossPrice;
        }
    }
}
