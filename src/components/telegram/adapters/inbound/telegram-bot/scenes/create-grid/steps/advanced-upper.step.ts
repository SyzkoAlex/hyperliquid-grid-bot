import { Injectable } from '@nestjs/common';
import { BotContext } from '../../../types/bot-context';
import { InlineButton } from '@components/telegram/core/domain/models/inline-button';
import { CREATE_GRID_ACTIONS } from '../create-grid-actions';
import { Inject } from '@nestjs/common';
import { TRADING_API_PORT, TradingApiPort } from '@components/trading/api/trading-api.port';
import { WizardStep } from '../wizard/wizard-step';
import { SceneStep } from '../create-grid-scene-step';
import { StepResult } from '../wizard/step-result';
import { WizardMessageManager } from '../wizard/wizard-message-manager';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels';
import {
    AdvancedUpperPromptMessage,
    AdvancedUpperConfirmationMessage,
} from '@components/telegram/core/domain/models/messages/wizard/advanced-upper.messages';
import { ValidationTexts } from '@components/telegram/core/domain/models/messages/wizard/validation.texts';

@Injectable()
export class AdvancedUpperStep implements WizardStep {
    readonly id = SceneStep.Upper;

    constructor(
        @Inject(TRADING_API_PORT) private readonly tradingApi: TradingApiPort,
        private readonly messageManager: WizardMessageManager,
    ) {}

    async enter(ctx: BotContext): Promise<void> {
        const keyboard: InlineButton[][] = [
            [
                { text: BUTTON_LABELS.BACK, action: CREATE_GRID_ACTIONS.BACK },
                { text: BUTTON_LABELS.CANCEL, action: CREATE_GRID_ACTIONS.CANCEL },
            ],
        ];

        const session = ctx.session;
        let message: string;
        if (session.createGrid?.symbol) {
            try {
                const currentPrice = await this.tradingApi.getCurrentPrice(
                    session.createGrid.symbol,
                );
                message = AdvancedUpperPromptMessage.create(
                    session.createGrid.symbol,
                    currentPrice,
                ).text;
            } catch (error) {
                message = AdvancedUpperPromptMessage.create(session.createGrid.symbol).text;
            }
        } else {
            message = AdvancedUpperPromptMessage.create().text;
        }

        await this.messageManager.sendEnterMessage(ctx, message, keyboard);
    }

    async handleTextInput(ctx: BotContext, text: string): Promise<StepResult> {
        const session = ctx.session;
        if (!session.createGrid) {
            return null;
        }

        const price = parseFloat(text);

        if (isNaN(price) || price <= 0) {
            await this.messageManager.sendEnterMessage(ctx, ValidationTexts.invalidPrice());
            return null;
        }

        session.createGrid.upperPrice = price;
        return {
            nextStep: SceneStep.Lower,
            confirmations: [AdvancedUpperConfirmationMessage.create(price).text],
        };
    }

    rollbackState(ctx: BotContext): void {
        if (ctx.session.createGrid) {
            delete ctx.session.createGrid.upperPrice;
        }
    }
}
