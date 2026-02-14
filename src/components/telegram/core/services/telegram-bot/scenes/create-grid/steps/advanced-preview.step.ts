import { Injectable } from '@nestjs/common';
import { BotContext } from '../../../types/bot-context';
import { InlineButton } from '../../../../../domain/inline-button';
import { CREATE_GRID_ACTIONS } from '../create-grid-actions';
import { WizardStep } from '../wizard/wizard-step';
import { SceneStep } from '../create-grid-scene-step';
import { WizardMessageManager } from '../wizard/wizard-message-manager';
import { CreateGridMode } from '../create-grid-mode';
import { HyperliquidInfoClient } from '@components/shared/secondary/clients/hyperliquid-info.client';
import { TradingSymbol } from '@domain/primitives/trading-symbol';

@Injectable()
export class AdvancedPreviewStep implements WizardStep {
    readonly id = SceneStep.Preview;

    constructor(
        private readonly messageManager: WizardMessageManager,
        private readonly hyperliquidClient: HyperliquidInfoClient,
    ) {}

    async enter(ctx: BotContext): Promise<void> {
        if (!this.validateState(ctx)) {
            await this.messageManager.sendEnterMessage(ctx, '❌ Invalid state. Please start over.');
            await ctx.scene.leave();
            return;
        }

        const session = ctx.session;
        const state = session.createGrid!;
        const orderSize =
            state.totalInvestmentUSDC && state.levels
                ? (state.totalInvestmentUSDC / state.levels).toFixed(2)
                : 'N/A';

        const keyboard: InlineButton[][] = [
            [{ text: '✅ Confirm', action: CREATE_GRID_ACTIONS.CONFIRM }],
            [
                { text: '← Back', action: CREATE_GRID_ACTIONS.BACK },
                { text: '❌ Cancel', action: CREATE_GRID_ACTIONS.CANCEL },
            ],
        ];

        let currentPriceText = '';
        try {
            const tradingSymbol = TradingSymbol.fromString(state.symbol!);
            const currentPrice = await this.hyperliquidClient.getCurrentPrice(tradingSymbol);
            currentPriceText = `🔸 Current Price: ${currentPrice.toNumber().toFixed(2)}\n`;
        } catch {
            // Ignore error, just don't show current price
        }

        const message =
            `<b>📋 Grid Configuration Preview</b>\n\n` +
            `🔸 Symbol: ${state.symbol}\n` +
            `🔸 Mode: ${state.gridMode}\n` +
            `🔸 Price Range: ${state.lowerPrice?.toFixed(4)} - ${state.upperPrice?.toFixed(4)}\n` +
            currentPriceText +
            `🔸 Levels: ${state.levels}\n` +
            `🔸 Investment: ${state.totalInvestmentUSDC} USDC\n` +
            `🔸 Order Size: ~${orderSize} USDC per level\n\n` +
            `Ready to create grid?`;

        await this.messageManager.sendEnterMessage(ctx, message, keyboard, 'HTML');
    }

    private validateState(ctx: BotContext): boolean {
        const session = ctx.session;
        const state = session.createGrid;
        return !!(
            state?.symbol &&
            state?.mode &&
            state?.gridMode &&
            state?.upperPrice &&
            state?.lowerPrice &&
            state?.levels &&
            state?.totalInvestmentUSDC
        );
    }

    rollbackState(ctx: BotContext): void {
        const session = ctx.session;
        const state = session.createGrid;
        if (!state) {
            return;
        }

        if (state.mode === CreateGridMode.Quick) {
            delete state.totalInvestmentUSDC;
            delete state.upperPrice;
            delete state.lowerPrice;
            delete state.levels;
        } else {
            delete state.totalInvestmentUSDC;
        }
    }
}
