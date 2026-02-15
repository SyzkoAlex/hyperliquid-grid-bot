import { Injectable } from '@nestjs/common';
import { BotContext } from '../../../types/bot-context';
import { InlineButton } from '../../../../../domain/inline-button';
import { CREATE_GRID_ACTIONS } from '../create-grid-actions';
import { HyperliquidInfoClient } from '@components/shared/secondary/clients/hyperliquid-info.client';
import { TradingSymbol } from '@domain/primitives/trading-symbol';
import { WizardStep } from '../wizard/wizard-step';
import { SceneStep } from '../create-grid-scene-step';
import { StepResult } from '../wizard/step-result';
import { WizardMessageManager } from '../wizard/wizard-message-manager';
import { BUTTON_LABELS } from '../../../../../domain/constants/button-labels.constants';
import { AdvancedUpperMessages } from '../../../../../domain/messages/wizard/advanced-upper.messages';
import { ValidationMessages } from '../../../../../domain/messages/wizard/validation.messages';

@Injectable()
export class AdvancedUpperStep implements WizardStep {
    readonly id = SceneStep.Upper;

    constructor(
        private readonly hyperliquidClient: HyperliquidInfoClient,
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
                const tradingSymbol = TradingSymbol.fromString(session.createGrid.symbol);
                const price = await this.hyperliquidClient.getCurrentPrice(tradingSymbol);
                message = AdvancedUpperMessages.prompt(session.createGrid.symbol, price.toNumber());
            } catch (error) {
                message = AdvancedUpperMessages.prompt(session.createGrid.symbol);
            }
        } else {
            message = AdvancedUpperMessages.prompt();
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
            await this.messageManager.sendEnterMessage(ctx, ValidationMessages.invalidPrice());
            return null;
        }

        session.createGrid.upperPrice = price;
        return {
            nextStep: SceneStep.Lower,
            confirmations: [AdvancedUpperMessages.confirmation(price)],
        };
    }

    rollbackState(ctx: BotContext): void {
        if (ctx.session.createGrid) {
            delete ctx.session.createGrid.upperPrice;
        }
    }
}
