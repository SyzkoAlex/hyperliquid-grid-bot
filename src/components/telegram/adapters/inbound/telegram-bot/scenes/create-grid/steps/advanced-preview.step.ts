import { Inject, Injectable } from '@nestjs/common';
import { BotContext } from '../../../types/bot-context';
import { InlineButton } from '@components/telegram/core/domain/models/inline-button';
import { CREATE_GRID_ACTIONS } from '../create-grid-actions';
import { WizardStep } from '../wizard/wizard-step';
import { SceneStep } from '../create-grid-scene-step';
import { WizardMessageManager } from '../wizard/wizard-message-manager';
import { CreateGridMode } from '../create-grid-mode';
import { TRADING_API_PORT, TradingApiPort } from '@components/trading/api/trading-api.port';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels';
import { AdvancedPreviewMessage } from '@components/telegram/core/domain/models/messages/wizard/advanced-preview.messages';
import { ValidationTexts } from '@components/telegram/core/domain/models/messages/wizard/validation.texts';
import { formatFiat } from '@components/telegram/core/domain/models/formatters/format-fiat';
import { TelegramParseMode } from '@components/telegram/core/domain/models/telegram-parse-mode';

@Injectable()
export class AdvancedPreviewStep implements WizardStep {
    readonly id = SceneStep.Preview;

    constructor(
        private readonly messageManager: WizardMessageManager,
        @Inject(TRADING_API_PORT) private readonly tradingApi: TradingApiPort,
    ) {}

    async enter(ctx: BotContext): Promise<void> {
        if (!this.validateState(ctx)) {
            await this.messageManager.sendEnterMessage(ctx, ValidationTexts.invalidState());
            await ctx.scene.leave();
            return;
        }

        const session = ctx.session;
        const state = session.createGrid!;
        const orderSize =
            state.totalInvestmentUSDC && state.levels
                ? formatFiat(state.totalInvestmentUSDC / state.levels)
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
            currentPrice = await this.tradingApi.getCurrentPrice(state.symbol!);
        } catch {
            // Ignore error, just don't show current price
        }

        const message = AdvancedPreviewMessage.create({
            symbol: state.symbol!,
            lowerPrice: state.lowerPrice!,
            upperPrice: state.upperPrice!,
            currentPrice,
            levels: state.levels!,
            totalInvestment: state.totalInvestmentUSDC!,
            orderSize,
        }).text;

        await this.messageManager.sendEnterMessage(ctx, message, keyboard, TelegramParseMode.HTML);
    }

    private validateState(ctx: BotContext): boolean {
        const session = ctx.session;
        const state = session.createGrid;
        return !!(
            state?.symbol &&
            state?.mode &&
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
