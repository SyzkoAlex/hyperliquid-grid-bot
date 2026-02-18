import { Injectable } from '@nestjs/common';
import { BotContext } from '../../../types/bot-context';
import { InlineButton } from '@components/telegram/domain/models/inline-button';
import { Inject } from '@nestjs/common';
import { INFO_CLIENT_PORT, InfoClientPort } from '@domain/ports/outbound/info-client.port';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { CREATE_GRID_ACTIONS, buildPairAction } from '../create-grid-actions';
import { WizardStep } from '../wizard/wizard-step';
import { SceneStep } from '../create-grid-scene-step';
import { StepResult } from '../wizard/step-result';
import { WizardMessageManager } from '../wizard/wizard-message-manager';
import { WIZARD_CONFIG } from '@components/telegram/domain/models/constants/wizard-config';
import { BUTTON_LABELS } from '@components/telegram/domain/models/constants/button-labels.constants';
import { SelectPairMessages } from '@components/telegram/domain/models/messages/wizard/select-pair.messages';
import { ValidationMessages } from '@components/telegram/domain/models/messages/wizard/validation.messages';

@Injectable()
export class SelectPairStep implements WizardStep {
    readonly id = SceneStep.Pair;

    constructor(
        @Inject(INFO_CLIENT_PORT) private readonly hyperliquidClient: InfoClientPort,
        private readonly messageManager: WizardMessageManager,
    ) {}

    async enter(ctx: BotContext): Promise<void> {
        const keyboard: InlineButton[][] = [
            ...WIZARD_CONFIG.POPULAR_TOKENS.map((token) => [
                { text: token, action: buildPairAction(token) },
            ]),
            [{ text: BUTTON_LABELS.OTHER_TOKEN, action: CREATE_GRID_ACTIONS.OTHER_PAIR }],
            [{ text: BUTTON_LABELS.CANCEL, action: CREATE_GRID_ACTIONS.CANCEL }],
        ];

        await this.messageManager.sendEnterMessage(ctx, SelectPairMessages.PROMPT, keyboard);
    }

    async handlePairSelection(ctx: BotContext, symbol: string): Promise<StepResult> {
        try {
            const tradingSymbol = TradingSymbol.fromString(symbol);
            const exists = await this.hyperliquidClient.pairExists(tradingSymbol);

            if (!exists) {
                await this.messageManager.sendEnterMessage(
                    ctx,
                    ValidationMessages.tokenNotFound(symbol),
                );
                return null;
            }

            if (!ctx.session.createGrid) {
                ctx.session.createGrid = {};
            }
            ctx.session.createGrid.symbol = symbol;

            return {
                nextStep: SceneStep.Mode,
                confirmations: [SelectPairMessages.confirmation(symbol)],
            };
        } catch (error) {
            await this.messageManager.sendEnterMessage(
                ctx,
                ValidationMessages.invalidTokenFormat(),
            );
            return null;
        }
    }

    async handleOtherPair(ctx: BotContext): Promise<void> {
        await this.messageManager.sendEnterMessage(ctx, SelectPairMessages.OTHER_TOKEN_PROMPT);
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
