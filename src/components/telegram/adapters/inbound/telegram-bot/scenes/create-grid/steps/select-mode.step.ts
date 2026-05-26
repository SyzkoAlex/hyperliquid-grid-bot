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

@Injectable()
export class SelectModeStep implements WizardStep {
    readonly id = SceneStep.Mode;

    constructor(@Inject(TRADING_API_PORT) private readonly tradingApi: TradingApiPort) {}

    async buildView(_ctx: BotContext): Promise<StepView> {
        return {
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

        const symbol = session.createGrid.symbol;
        if (symbol) {
            try {
                session.createGrid.currentPrice = await this.tradingApi.getCurrentPrice(symbol);
            } catch {
                // price not critical — summary will fall back to symbol only
            }
        }

        const nextStep = mode === CreateGridMode.Quick ? SceneStep.Quick : SceneStep.Upper;
        return { nextStep };
    }

    rollbackState(ctx: BotContext): void {
        if (ctx.session.createGrid) {
            delete ctx.session.createGrid.mode;
        }
    }
}
