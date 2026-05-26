import { Injectable } from '@nestjs/common';
import { BotContext } from '../../../types/bot-context';
import { InlineButton } from '@components/telegram/core/domain/models/inline-button';
import { CREATE_GRID_ACTIONS, PricePresetKey, buildLowerPreset } from '../create-grid-actions';
import { WizardStep } from '../wizard/wizard-step';
import { SceneStep } from '../create-grid-scene-step';
import { StepResult } from '../wizard/step-result';
import { StepView } from '../wizard/step-view';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels';
import { AdvancedLowerPromptMessage } from '@components/telegram/core/domain/models/messages/wizard/advanced-lower.messages';
import { ValidationTexts } from '@components/telegram/core/domain/models/messages/wizard/validation.texts';
import { PriceFormatter } from '@components/telegram/core/domain/models/formatters/price.formatter';

@Injectable()
export class AdvancedLowerStep implements WizardStep {
    readonly id = SceneStep.Lower;

    async buildView(ctx: BotContext): Promise<StepView> {
        const state = ctx.session.createGrid;
        const symbol = state?.symbol;
        const currentPrice = state?.currentPrice;
        return {
            body: AdvancedLowerPromptMessage.create(symbol, currentPrice).text,
            keyboard: this.buildKeyboard(currentPrice),
        };
    }

    private buildKeyboard(currentPrice: number | undefined): InlineButton[][] {
        const presets: InlineButton[] =
            currentPrice !== undefined
                ? [10, 20, 30].map((pct) => ({
                      text: `-${pct}% (${PriceFormatter.format(currentPrice * (1 - pct / 100))})`,
                      action: buildLowerPreset(pct),
                  }))
                : [];
        const rows: InlineButton[][] = presets.map((b) => [b]);
        rows.push([
            { text: BUTTON_LABELS.CUSTOM, action: buildLowerPreset(PricePresetKey.Custom) },
        ]);
        rows.push([
            { text: BUTTON_LABELS.BACK, action: CREATE_GRID_ACTIONS.BACK },
            { text: BUTTON_LABELS.CANCEL, action: CREATE_GRID_ACTIONS.CANCEL },
        ]);
        return rows;
    }

    async handleLowerPreset(ctx: BotContext, raw: string): Promise<StepResult> {
        if (raw === PricePresetKey.Custom) {
            if (ctx.session.createGrid) {
                ctx.session.createGrid.pendingError = ValidationTexts.enterCustomLowerPrice();
            }
            return null;
        }
        const pct = parseInt(raw, 10);
        const basePrice =
            ctx.session.createGrid?.currentPrice ?? ctx.session.createGrid?.upperPrice;
        if (!basePrice) return null;
        const price = basePrice * (1 - pct / 100);
        ctx.session.createGrid!.lowerPrice = price;
        return { nextStep: SceneStep.Levels };
    }

    async handleTextInput(ctx: BotContext, text: string): Promise<StepResult> {
        const session = ctx.session;
        if (!session.createGrid?.upperPrice) {
            return null;
        }

        const price = parseFloat(text);

        if (isNaN(price) || price <= 0) {
            session.createGrid.pendingError = ValidationTexts.invalidPrice();
            return null;
        }

        if (price >= session.createGrid.upperPrice) {
            session.createGrid.pendingError = ValidationTexts.lowerPriceMustBeLess(
                session.createGrid.upperPrice,
            );
            return null;
        }

        session.createGrid.lowerPrice = price;
        return { nextStep: SceneStep.Levels };
    }

    rollbackState(ctx: BotContext): void {
        if (ctx.session.createGrid) {
            delete ctx.session.createGrid.lowerPrice;
        }
    }
}
