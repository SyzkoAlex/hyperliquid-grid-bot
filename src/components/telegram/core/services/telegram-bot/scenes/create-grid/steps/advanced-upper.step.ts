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
                { text: '← Back', action: CREATE_GRID_ACTIONS.BACK },
                { text: '❌ Cancel', action: CREATE_GRID_ACTIONS.CANCEL },
            ],
        ];

        const session = ctx.session;
        let message = 'Enter upper price for the grid:';
        if (session.createGrid?.symbol) {
            try {
                const tradingSymbol = TradingSymbol.fromString(session.createGrid.symbol);
                const price = await this.hyperliquidClient.getCurrentPrice(tradingSymbol);
                const currentPrice = price.toNumber();
                message += `\n\nCurrent ${session.createGrid.symbol} price: ${currentPrice.toFixed(4)}`;
            } catch (error) {
                message += `\n\n⚠️ Could not fetch current price`;
            }
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
            await this.messageManager.sendEnterMessage(
                ctx,
                '❌ Invalid price. Please enter a positive number:',
            );
            return null;
        }

        session.createGrid.upperPrice = price;
        return {
            nextStep: SceneStep.Lower,
            confirmations: [`✅ Upper price set: ${price.toFixed(4)}`],
        };
    }

    rollbackState(ctx: BotContext): void {
        if (ctx.session.createGrid) {
            delete ctx.session.createGrid.upperPrice;
        }
    }
}
