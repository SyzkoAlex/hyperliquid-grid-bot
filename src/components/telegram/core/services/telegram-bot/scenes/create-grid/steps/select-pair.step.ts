import { Injectable } from '@nestjs/common';
import { BotContext } from '../../../types/bot-context';
import { InlineButton } from '../../../../../domain/inline-button';
import { HyperliquidInfoClient } from '@components/shared/secondary/clients/hyperliquid-info.client';
import { TradingSymbol } from '@domain/primitives/trading-symbol';
import { CREATE_GRID_ACTIONS, buildPairAction } from '../create-grid-actions';
import { WizardStep } from '../wizard/wizard-step';
import { SceneStep } from '../create-grid-scene-step';
import { StepResult } from '../wizard/step-result';
import { WizardMessageManager } from '../wizard/wizard-message-manager';

const POPULAR_TOKENS = ['HYPE', 'BTC', 'ETH', 'SOL'];

@Injectable()
export class SelectPairStep implements WizardStep {
    readonly id = SceneStep.Pair;

    constructor(
        private readonly hyperliquidClient: HyperliquidInfoClient,
        private readonly messageManager: WizardMessageManager,
    ) {}

    async enter(ctx: BotContext): Promise<void> {
        const keyboard: InlineButton[][] = [
            ...POPULAR_TOKENS.map((token) => [{ text: token, action: buildPairAction(token) }]),
            [{ text: '🔍 Other token', action: CREATE_GRID_ACTIONS.OTHER_PAIR }],
            [{ text: '❌ Cancel', action: CREATE_GRID_ACTIONS.CANCEL }],
        ];

        await this.messageManager.sendEnterMessage(
            ctx,
            'Select token (all pairs trade against USDC):',
            keyboard,
        );
    }

    async handlePairSelection(ctx: BotContext, symbol: string): Promise<StepResult> {
        try {
            const tradingSymbol = TradingSymbol.fromString(symbol);
            const exists = await this.hyperliquidClient.pairExists(tradingSymbol);

            if (!exists) {
                await this.messageManager.sendEnterMessage(
                    ctx,
                    `❌ Token ${symbol} not found. Please try another token.`,
                );
                return null;
            }

            if (!ctx.session.createGrid) {
                ctx.session.createGrid = {};
            }
            ctx.session.createGrid.symbol = symbol;

            return {
                nextStep: SceneStep.Mode,
                confirmations: [`✅ Selected: ${symbol}/USDC`],
            };
        } catch (error) {
            await this.messageManager.sendEnterMessage(
                ctx,
                '❌ Invalid token format. Please try another token.',
            );
            return null;
        }
    }

    async handleOtherPair(ctx: BotContext): Promise<void> {
        await this.messageManager.sendEnterMessage(
            ctx,
            'Enter token symbol (e.g., HYPE, BTC, ETH):',
        );
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
