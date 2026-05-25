import { Injectable } from '@nestjs/common';
import { BotContext } from '../../../types/bot-context';
import { InlineButton } from '@components/telegram/core/domain/models/inline-button';
import { Inject } from '@nestjs/common';
import {
    TRADING_API_PORT,
    TradingApiPort,
    TokenDescriptorDto,
} from '@components/trading/api/trading-api.port';
import { CREATE_GRID_ACTIONS, buildPairAction } from '../create-grid-actions';
import { WizardStep } from '../wizard/wizard-step';
import { SceneStep } from '../create-grid-scene-step';
import { StepResult } from '../wizard/step-result';
import { StepView } from '../wizard/step-view';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels';
import { SelectPairTexts } from '@components/telegram/core/domain/models/messages/wizard/select-pair.messages';
import { ValidationTexts } from '@components/telegram/core/domain/models/messages/wizard/validation.texts';

@Injectable()
export class SelectPairStep implements WizardStep {
    readonly id = SceneStep.Pair;

    constructor(@Inject(TRADING_API_PORT) private readonly tradingApi: TradingApiPort) {}

    async buildView(_ctx: BotContext): Promise<StepView> {
        let topTokens: TokenDescriptorDto[] = [];
        try {
            topTokens = await this.tradingApi.getTopSymbolsByVolume();
        } catch {
            // graceful empty list; user can still enter manually
        }

        const keyboard: InlineButton[][] = [
            ...topTokens.map((t: TokenDescriptorDto) => [
                {
                    text: t.displayName === t.symbol ? t.symbol : `${t.displayName} (${t.symbol})`,
                    action: buildPairAction(t.symbol),
                },
            ]),
            [{ text: BUTTON_LABELS.OTHER_TOKEN, action: CREATE_GRID_ACTIONS.OTHER_PAIR }],
            [{ text: BUTTON_LABELS.CANCEL, action: CREATE_GRID_ACTIONS.CANCEL }],
        ];

        return { body: SelectPairTexts.PROMPT, keyboard };
    }

    async handlePairSelection(ctx: BotContext, symbol: string): Promise<StepResult> {
        try {
            const exists = await this.tradingApi.pairExists(symbol);

            if (!exists) {
                if (ctx.session.createGrid) {
                    ctx.session.createGrid.pendingError = ValidationTexts.tokenNotFound(symbol);
                }
                return null;
            }

            ctx.session.createGrid!.symbol = symbol;

            return { nextStep: SceneStep.Mode };
        } catch {
            if (ctx.session.createGrid) {
                ctx.session.createGrid.pendingError = ValidationTexts.invalidTokenFormat();
            }
            return null;
        }
    }

    async handleOtherPair(ctx: BotContext): Promise<void> {
        if (ctx.session.createGrid) {
            ctx.session.createGrid.pendingError = SelectPairTexts.OTHER_TOKEN_PROMPT;
        }
    }

    async handleTextInput(ctx: BotContext, text: string): Promise<StepResult> {
        const symbol = text.trim().toUpperCase();
        return this.handlePairSelection(ctx, symbol);
    }

    rollbackState(ctx: BotContext): void {
        if (ctx.session.createGrid) {
            delete ctx.session.createGrid.symbol;
        }
    }
}
