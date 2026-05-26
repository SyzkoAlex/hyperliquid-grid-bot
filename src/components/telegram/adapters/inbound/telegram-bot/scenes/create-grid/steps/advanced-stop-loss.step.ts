import { Injectable } from '@nestjs/common';
import { BotContext } from '../../../types/bot-context';
import { InlineButton } from '@components/telegram/core/domain/models/inline-button';
import {
    CREATE_GRID_ACTIONS,
    StopLossPresetKey,
    buildStopLossPreset,
} from '../create-grid-actions';
import { WizardStep } from '../wizard/wizard-step';
import { SceneStep } from '../create-grid-scene-step';
import { StepResult } from '../wizard/step-result';
import { StepView } from '../wizard/step-view';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels';
import { AdvancedStopLossPromptMessage } from '@components/telegram/core/domain/models/messages/wizard/advanced-stop-loss-prompt.message';
import { ValidationTexts } from '@components/telegram/core/domain/models/messages/wizard/validation.texts';
import { PriceFormatter } from '@components/telegram/core/domain/models/formatters/price.formatter';
import { STOP_LOSS_MIN_BUFFER_FROM_LOWER } from '@domain/constants/stop-loss.constants';

@Injectable()
export class AdvancedStopLossStep implements WizardStep {
    readonly id = SceneStep.StopLoss;

    async buildView(ctx: BotContext): Promise<StepView> {
        const lowerPrice = ctx.session.createGrid?.lowerPrice;
        return {
            body: AdvancedStopLossPromptMessage.create(lowerPrice).text,
            keyboard: this.buildKeyboard(lowerPrice),
        };
    }

    private buildKeyboard(lowerPrice: number | undefined): InlineButton[][] {
        const presets: InlineButton[] =
            lowerPrice !== undefined
                ? [
                      {
                          text: `−5% (${PriceFormatter.format(lowerPrice * 0.95)})`,
                          action: buildStopLossPreset(StopLossPresetKey.P5),
                      },
                      {
                          text: `−10% (${PriceFormatter.format(lowerPrice * 0.9)})`,
                          action: buildStopLossPreset(StopLossPresetKey.P10),
                      },
                      {
                          text: `−20% (${PriceFormatter.format(lowerPrice * 0.8)})`,
                          action: buildStopLossPreset(StopLossPresetKey.P20),
                      },
                  ]
                : [];
        return [
            [{ text: BUTTON_LABELS.SKIP_NO_SL, action: CREATE_GRID_ACTIONS.STOP_LOSS_OFF }],
            ...(presets.length ? [presets] : []),
            [{ text: BUTTON_LABELS.CUSTOM, action: buildStopLossPreset(StopLossPresetKey.Custom) }],
            [
                { text: BUTTON_LABELS.BACK, action: CREATE_GRID_ACTIONS.BACK },
                { text: BUTTON_LABELS.CANCEL, action: CREATE_GRID_ACTIONS.CANCEL },
            ],
        ];
    }

    async handleStopLossPreset(ctx: BotContext, key: string): Promise<StepResult> {
        if (key === StopLossPresetKey.Custom) {
            if (ctx.session.createGrid) {
                ctx.session.createGrid.pendingError = ValidationTexts.enterCustomStopLoss();
            }
            return null;
        }
        const lowerPrice = ctx.session.createGrid?.lowerPrice;
        if (!lowerPrice) return null;
        const pct = parseInt(key, 10);
        const price = lowerPrice * (1 - pct / 100);
        ctx.session.createGrid!.stopLossEnabled = true;
        ctx.session.createGrid!.stopLossPrice = price;
        return { nextStep: SceneStep.Preview };
    }

    async handleTextInput(ctx: BotContext, text: string): Promise<StepResult> {
        const session = ctx.session;
        const lowerPrice = session.createGrid?.lowerPrice;

        if (!lowerPrice) {
            return null;
        }

        const price = parseFloat(text);

        if (isNaN(price) || price <= 0) {
            session.createGrid!.pendingError = ValidationTexts.stopLossMustBePositive();
            return null;
        }

        if (price >= lowerPrice) {
            session.createGrid!.pendingError = ValidationTexts.stopLossMustBeBelowLower(lowerPrice);
            return null;
        }

        const maxAllowed = lowerPrice * (1 - STOP_LOSS_MIN_BUFFER_FROM_LOWER);
        if (price > maxAllowed) {
            session.createGrid!.pendingError = ValidationTexts.stopLossTooCloseToLower(lowerPrice);
            return null;
        }

        session.createGrid!.stopLossEnabled = true;
        session.createGrid!.stopLossPrice = price;

        return { nextStep: SceneStep.Preview };
    }

    async handleSkip(ctx: BotContext): Promise<StepResult> {
        const session = ctx.session;
        if (session.createGrid) {
            session.createGrid.stopLossEnabled = false;
            delete session.createGrid.stopLossPrice;
        }
        return { nextStep: SceneStep.Preview };
    }

    rollbackState(ctx: BotContext): void {
        if (ctx.session.createGrid) {
            delete ctx.session.createGrid.stopLossEnabled;
            delete ctx.session.createGrid.stopLossPrice;
        }
    }
}
