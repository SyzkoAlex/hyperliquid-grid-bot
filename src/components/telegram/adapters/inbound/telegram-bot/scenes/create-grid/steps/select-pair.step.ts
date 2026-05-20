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
import { WizardMessageManager } from '../wizard/wizard-message-manager';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels';
import {
    SelectPairTexts,
    SelectPairConfirmationMessage,
} from '@components/telegram/core/domain/models/messages/wizard/select-pair.messages';
import { ValidationTexts } from '@components/telegram/core/domain/models/messages/wizard/validation.texts';

@Injectable()
export class SelectPairStep implements WizardStep {
    readonly id = SceneStep.Pair;

    constructor(
        @Inject(TRADING_API_PORT) private readonly tradingApi: TradingApiPort,
        private readonly messageManager: WizardMessageManager,
    ) {}

    async enter(ctx: BotContext): Promise<void> {
        let topTokens: TokenDescriptorDto[] = [];
        try {
            topTokens = await this.tradingApi.getTopSymbolsByVolume();
        } catch {
            // fall through with empty list; user can still enter a pair manually
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

        await this.messageManager.sendEnterMessage(ctx, SelectPairTexts.PROMPT, keyboard);
    }

    async handlePairSelection(ctx: BotContext, symbol: string): Promise<StepResult> {
        try {
            const exists = await this.tradingApi.pairExists(symbol);

            if (!exists) {
                await this.messageManager.sendEnterMessage(
                    ctx,
                    ValidationTexts.tokenNotFound(symbol),
                );
                return null;
            }

            ctx.session.createGrid!.symbol = symbol;

            return {
                nextStep: SceneStep.Mode,
                confirmations: [SelectPairConfirmationMessage.create(symbol).text],
            };
        } catch (error) {
            await this.messageManager.sendEnterMessage(ctx, ValidationTexts.invalidTokenFormat());
            return null;
        }
    }

    async handleOtherPair(ctx: BotContext): Promise<void> {
        await this.messageManager.sendEnterMessage(ctx, SelectPairTexts.OTHER_TOKEN_PROMPT);
    }

    async handleTextInput(ctx: BotContext, text: string): Promise<StepResult> {
        const symbol = text.trim().toUpperCase();
        return await this.handlePairSelection(ctx, symbol);
    }

    rollbackState(ctx: BotContext): void {
        if (ctx.session.createGrid) {
            delete ctx.session.createGrid.symbol;
        }
    }
}
