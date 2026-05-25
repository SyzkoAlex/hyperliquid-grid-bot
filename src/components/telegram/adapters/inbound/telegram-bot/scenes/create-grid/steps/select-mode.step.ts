import { Inject, Injectable } from '@nestjs/common';
import { BotContext } from '../../../types/bot-context';
import { CreateGridMode } from '../create-grid-mode';
import { CREATE_GRID_ACTIONS } from '../create-grid-actions';
import { WizardStep } from '../wizard/wizard-step';
import { SceneStep } from '../create-grid-scene-step';
import { StepResult } from '../wizard/step-result';
import { StepView } from '../wizard/step-view';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels';
import { SelectModeTexts } from '@components/telegram/core/domain/models/messages/wizard/select-mode.texts';
import { TRADING_API_PORT, TradingApiPort } from '@components/trading/api/trading-api.port';
import { formatFiat } from '@components/telegram/core/domain/models/formatters/format-fiat';

@Injectable()
export class SelectModeStep implements WizardStep {
    readonly id = SceneStep.Mode;

    constructor(@Inject(TRADING_API_PORT) private readonly tradingApi: TradingApiPort) {}

    async buildView(ctx: BotContext): Promise<StepView> {
        const symbol = ctx.session.createGrid?.symbol;
        let pairValue = symbol ?? '';
        if (symbol) {
            try {
                const price = await this.tradingApi.getCurrentPrice(symbol);
                pairValue = `${symbol} ($${formatFiat(price)})`;
            } catch {
                pairValue = symbol;
            }
        }
        return {
            summaryRows: symbol ? [{ label: 'Pair', value: pairValue }] : undefined,
            body: SelectModeTexts.PROMPT,
            keyboard: [
                [{ text: BUTTON_LABELS.MODE_QUICK, action: CREATE_GRID_ACTIONS.MODE_QUICK }],
                [{ text: BUTTON_LABELS.MODE_ADVANCED, action: CREATE_GRID_ACTIONS.MODE_ADVANCED }],
                [
                    { text: BUTTON_LABELS.BACK, action: CREATE_GRID_ACTIONS.BACK },
                    { text: BUTTON_LABELS.CANCEL, action: CREATE_GRID_ACTIONS.CANCEL },
                ],
            ],
        };
    }

    async handleModeSelection(ctx: BotContext, mode: CreateGridMode): Promise<StepResult> {
        const session = ctx.session;
        if (!session.createGrid) {
            session.createGrid = {};
        }
        session.createGrid.mode = mode;

        const nextStep = mode === CreateGridMode.Quick ? SceneStep.Quick : SceneStep.Upper;

        return { nextStep };
    }

    rollbackState(ctx: BotContext): void {
        if (ctx.session.createGrid) {
            delete ctx.session.createGrid.mode;
        }
    }
}
