import { Injectable } from '@nestjs/common';
import { BotContext } from '../../../types/bot-context';
import { InlineButton } from '@components/telegram/core/domain/models/inline-button';
import { CREATE_GRID_ACTIONS, PricePresetKey, buildUpperPreset } from '../create-grid-actions';
import { Inject } from '@nestjs/common';
import { TRADING_API_PORT, TradingApiPort } from '@components/trading/api/trading-api.port';
import { WizardStep } from '../wizard/wizard-step';
import { SceneStep } from '../create-grid-scene-step';
import { StepResult } from '../wizard/step-result';
import { StepView } from '../wizard/step-view';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels';
import { AdvancedUpperPromptMessage } from '@components/telegram/core/domain/models/messages/wizard/advanced-upper.messages';
import { ValidationTexts } from '@components/telegram/core/domain/models/messages/wizard/validation.texts';
import { PriceFormatter } from '@components/telegram/core/domain/models/formatters/price.formatter';

@Injectable()
export class AdvancedUpperStep implements WizardStep {
    readonly id = SceneStep.Upper;

    constructor(@Inject(TRADING_API_PORT) private readonly tradingApi: TradingApiPort) {}

    async buildView(ctx: BotContext): Promise<StepView> {
        const symbol = ctx.session.createGrid?.symbol;
        let currentPrice: number | null = null;
        try {
            if (symbol) {
                currentPrice = await this.tradingApi.getCurrentPrice(symbol);
            }
        } catch {
            // ignore — show prompt without price
        }

        return {
            body: AdvancedUpperPromptMessage.create(symbol, currentPrice ?? undefined).text,
            keyboard: this.buildKeyboard(currentPrice),
        };
    }

    private buildKeyboard(currentPrice: number | null): InlineButton[][] {
        const presets: InlineButton[] =
            currentPrice !== null
                ? [10, 20, 30].map((pct) => ({
                      text: `+${pct}% (${PriceFormatter.format(currentPrice * (1 + pct / 100))})`,
                      action: buildUpperPreset(pct),
                  }))
                : [];
        const rows: InlineButton[][] = presets.length ? [presets] : [];
        rows.push([
            { text: BUTTON_LABELS.CUSTOM, action: buildUpperPreset(PricePresetKey.Custom) },
        ]);
        rows.push([
            { text: BUTTON_LABELS.BACK, action: CREATE_GRID_ACTIONS.BACK },
            { text: BUTTON_LABELS.CANCEL, action: CREATE_GRID_ACTIONS.CANCEL },
        ]);
        return rows;
    }

    async handleUpperPreset(ctx: BotContext, raw: string): Promise<StepResult> {
        if (raw === PricePresetKey.Custom) {
            if (ctx.session.createGrid) {
                ctx.session.createGrid.pendingError = ValidationTexts.enterCustomUpperPrice();
            }
            return null;
        }
        const pct = parseInt(raw, 10);
        const symbol = ctx.session.createGrid?.symbol;
        if (!symbol) return null;
        const currentPrice = await this.tradingApi.getCurrentPrice(symbol);
        const price = parseFloat((currentPrice * (1 + pct / 100)).toPrecision(8));
        ctx.session.createGrid!.upperPrice = price;
        return { nextStep: SceneStep.Lower };
    }

    async handleTextInput(ctx: BotContext, text: string): Promise<StepResult> {
        const session = ctx.session;
        if (!session.createGrid) {
            return null;
        }

        const price = parseFloat(text);

        if (isNaN(price) || price <= 0) {
            session.createGrid.pendingError = ValidationTexts.invalidPrice();
            return null;
        }

        session.createGrid.upperPrice = price;
        return { nextStep: SceneStep.Lower };
    }

    rollbackState(ctx: BotContext): void {
        if (ctx.session.createGrid) {
            delete ctx.session.createGrid.upperPrice;
        }
    }
}
