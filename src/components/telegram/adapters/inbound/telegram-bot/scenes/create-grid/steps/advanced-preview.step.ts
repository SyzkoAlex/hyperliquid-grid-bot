import { Injectable } from '@nestjs/common';
import { BotContext } from '../../../types/bot-context';
import { InlineButton } from '@components/telegram/core/domain/models/inline-button';
import { CREATE_GRID_ACTIONS } from '../create-grid-actions';
import { WizardStep } from '../wizard/wizard-step';
import { SceneStep } from '../create-grid-scene-step';
import { WizardMessageManager } from '../wizard/wizard-message-manager';
import { CreateGridMode } from '../create-grid-mode';
import { Inject } from '@nestjs/common';
import {
    EXCHANGE_INFO_PORT,
    ExchangeInfoPort,
} from '@components/telegram/core/application/ports/exchange-info.port';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels.constants';
import { AdvancedPreviewMessages } from '@components/telegram/core/domain/models/messages/wizard/advanced-preview.messages';
import { ValidationMessages } from '@components/telegram/core/domain/models/messages/wizard/validation.messages';

@Injectable()
export class AdvancedPreviewStep implements WizardStep {
    readonly id = SceneStep.Preview;

    constructor(
        private readonly messageManager: WizardMessageManager,
        @Inject(EXCHANGE_INFO_PORT) private readonly hyperliquidClient: ExchangeInfoPort,
    ) {}

    async enter(ctx: BotContext): Promise<void> {
        if (!this.validateState(ctx)) {
            await this.messageManager.sendEnterMessage(ctx, ValidationMessages.invalidState());
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
            [{ text: BUTTON_LABELS.CONFIRM, action: CREATE_GRID_ACTIONS.CONFIRM }],
            [
                { text: BUTTON_LABELS.BACK, action: CREATE_GRID_ACTIONS.BACK },
                { text: BUTTON_LABELS.CANCEL, action: CREATE_GRID_ACTIONS.CANCEL },
            ],
        ];

        let currentPrice: number | null = null;
        try {
            const tradingSymbol = TradingSymbol.fromString(state.symbol!);
            const price = await this.hyperliquidClient.getCurrentPrice(tradingSymbol);
            currentPrice = price.toNumber();
        } catch {
            // Ignore error, just don't show current price
        }

        const message = AdvancedPreviewMessages.preview(
            state.symbol!,
            state.gridMode!,
            state.lowerPrice!,
            state.upperPrice!,
            currentPrice,
            state.levels!,
            state.totalInvestmentUSDC!,
            orderSize,
        );

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
