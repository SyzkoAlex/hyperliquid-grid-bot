import { Inject, Injectable } from '@nestjs/common';
import { BotContext } from '../../../types/bot-context';
import { InlineButton } from '@components/telegram/core/domain/models/inline-button';
import { CREATE_GRID_ACTIONS } from '../create-grid-actions';
import { WizardStep } from '../wizard/wizard-step';
import { SceneStep } from '../create-grid-scene-step';
import { StepView } from '../wizard/step-view';
import { CreateGridMode } from '../create-grid-mode';
import { TRADING_API_PORT, TradingApiPort } from '@components/trading/api/trading-api.port';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels';
import { AdvancedPreviewMessage } from '@components/telegram/core/domain/models/messages/wizard/advanced-preview.messages';
import { ValidationTexts } from '@components/telegram/core/domain/models/messages/wizard/validation.texts';
import { formatFiat } from '@components/telegram/core/domain/models/formatters/format-fiat';
import { calculateGridFeeMetrics } from '@components/telegram/core/domain/models/grid-fee-calculator';

@Injectable()
export class AdvancedPreviewStep implements WizardStep {
    readonly id = SceneStep.Preview;

    constructor(@Inject(TRADING_API_PORT) private readonly tradingApi: TradingApiPort) {}

    async buildView(ctx: BotContext): Promise<StepView> {
        if (!this.validateState(ctx)) {
            return {
                body: ValidationTexts.invalidState(),
                keyboard: [
                    [
                        { text: BUTTON_LABELS.BACK, action: CREATE_GRID_ACTIONS.BACK },
                        { text: BUTTON_LABELS.CANCEL, action: CREATE_GRID_ACTIONS.CANCEL },
                    ],
                ],
            };
        }

        const state = ctx.session.createGrid!;
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
            // Ignore error — just don't show current price
        }

        const lowerPrice = state.lowerPrice!;
        const upperPrice = state.upperPrice!;
        const levels = state.levels!;
        const totalInvestment = state.totalInvestmentUSDC!;

        const feeMetrics = calculateGridFeeMetrics({
            lowerPrice,
            upperPrice,
            levels,
            totalInvestment,
        });

        const body = AdvancedPreviewMessage.create({
            symbol: state.symbol!,
            lowerPrice,
            upperPrice,
            currentPrice,
            levels,
            totalInvestment,
            orderSize,
            stopLossEnabled: state.stopLossEnabled,
            stopLossPrice: state.stopLossPrice,
            feeMetrics,
        }).text;

        return { body, keyboard };
    }

    private validateState(ctx: BotContext): boolean {
        const state = ctx.session.createGrid;
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
