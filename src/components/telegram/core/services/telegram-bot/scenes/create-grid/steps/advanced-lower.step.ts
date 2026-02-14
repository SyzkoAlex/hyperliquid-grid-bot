import { Injectable } from '@nestjs/common';
import { BotContext } from '../../../types/bot-context';
import { InlineButton } from '../../../../../domain/inline-button';
import { CREATE_GRID_ACTIONS } from '../create-grid-actions';
import { WizardStep } from '../wizard/wizard-step';
import { SceneStep } from '../create-grid-scene-step';
import { StepResult } from '../wizard/step-result';
import { WizardMessageManager } from '../wizard/wizard-message-manager';

@Injectable()
export class AdvancedLowerStep implements WizardStep {
    readonly id = SceneStep.Lower;

    constructor(private readonly messageManager: WizardMessageManager) {}

    async enter(ctx: BotContext): Promise<void> {
        const keyboard: InlineButton[][] = [
            [
                { text: '← Back', action: CREATE_GRID_ACTIONS.BACK },
                { text: '❌ Cancel', action: CREATE_GRID_ACTIONS.CANCEL },
            ],
        ];

        const session = ctx.session;
        let message = 'Enter lower price for the grid:';
        if (session.createGrid?.upperPrice) {
            message += `\n\nUpper price: ${session.createGrid.upperPrice.toFixed(4)}`;
        }

        await this.messageManager.sendEnterMessage(ctx, message, keyboard);
    }

    async handleTextInput(ctx: BotContext, text: string): Promise<StepResult> {
        const session = ctx.session;
        if (!session.createGrid?.upperPrice) {
            return null;
        }

        const price = parseFloat(text);

        if (isNaN(price) || price <= 0) {
            await this.messageManager.sendEnterMessage(
                ctx,
                '❌ Invalid price. Please enter a positive number:',
            );
            return null;
        }

        if (price >= session.createGrid.upperPrice) {
            await this.messageManager.sendEnterMessage(
                ctx,
                `❌ Lower price must be less than upper price (${session.createGrid.upperPrice.toFixed(4)})\n\nPlease enter a valid price:`,
            );
            return null;
        }

        session.createGrid.lowerPrice = price;
        return {
            nextStep: SceneStep.Levels,
            confirmations: [`✅ Lower price set: ${price.toFixed(4)}`],
        };
    }

    rollbackState(ctx: BotContext): void {
        if (ctx.session.createGrid) {
            delete ctx.session.createGrid.lowerPrice;
        }
    }
}
