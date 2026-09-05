import { Injectable } from '@nestjs/common';
import { BotContext } from '../../../types/bot-context';
import { StepView } from './step-view';
import { toInlineKeyboard } from '../../../handlers/inline-keyboard';
import { TelegramParseMode } from '@components/telegram/core/domain/models/telegram-parse-mode';
import { logger } from '@/infra/logger/logger';
import { CreateGridWizardState } from '../create-grid-wizard-state';
import { CreateGridMode } from '../create-grid-mode';
import { SceneStep } from '../create-grid-scene-step';
import { investmentStepForMode } from '../helpers/investment-step-for-mode';
import { WizardSummaryBuilder } from './wizard-summary-builder';

// Canonical rendered-step sequences. Confirm is a button on Preview, not a screen,
// so it is not part of the sequence. Swap is a detour and borrows the position of
// the investment step it was opened from.
const PRE_MODE_STEPS: readonly SceneStep[] = [SceneStep.Pair, SceneStep.Mode];
const QUICK_STEPS: readonly SceneStep[] = [
    SceneStep.Pair,
    SceneStep.Mode,
    SceneStep.Quick,
    SceneStep.Preview,
];
const AI_STEPS: readonly SceneStep[] = [
    SceneStep.Pair,
    SceneStep.Mode,
    SceneStep.Ai,
    SceneStep.Preview,
];
const ADVANCED_STEPS: readonly SceneStep[] = [
    SceneStep.Pair,
    SceneStep.Mode,
    SceneStep.Upper,
    SceneStep.Lower,
    SceneStep.Orders,
    SceneStep.Investment,
    SceneStep.StopLoss,
    SceneStep.Preview,
];

@Injectable()
export class BoardRenderer {
    private readonly logger = logger.child({ context: BoardRenderer.name });

    constructor(private readonly wizardSummaryBuilder: WizardSummaryBuilder) {}

    async render(ctx: BotContext, view: StepView): Promise<void> {
        const state = ctx.session.createGrid;
        const pendingError = state?.pendingError;

        const stepper = this.buildStepper(state);
        const summary = this.wizardSummaryBuilder.buildSummaryFromSession(state);

        let text = stepper ? `${stepper}\n\n` : '';
        if (summary) {
            text += `${summary}\n\n`;
        }
        if (pendingError) {
            text += `${pendingError}\n\n`;
        }
        text += view.body;

        const markup = toInlineKeyboard(view.keyboard);

        if (!state?.boardChatId || !state?.boardMessageId) {
            const msg = await ctx.reply(text, {
                parse_mode: TelegramParseMode.HTML,
                ...markup,
            });
            if (ctx.session.createGrid) {
                ctx.session.createGrid.boardChatId = msg.chat.id;
                ctx.session.createGrid.boardMessageId = msg.message_id;
            }
            return;
        }

        try {
            await ctx.telegram.editMessageText(
                state.boardChatId,
                state.boardMessageId,
                undefined,
                text,
                { parse_mode: TelegramParseMode.HTML, ...markup },
            );
        } catch (error) {
            const err = error as { response?: { description?: string } };
            const description = err.response?.description ?? '';
            if (description.includes('message is not modified')) {
                return;
            }
            if (description.includes('message to edit not found')) {
                this.logger.warn('Board message not found, sending new board message');
                const msg = await ctx.reply(text, {
                    parse_mode: TelegramParseMode.HTML,
                    ...markup,
                });
                if (ctx.session.createGrid) {
                    ctx.session.createGrid.boardChatId = msg.chat.id;
                    ctx.session.createGrid.boardMessageId = msg.message_id;
                }
                return;
            }
            throw error;
        }
    }

    private buildStepper(state: CreateGridWizardState | undefined): string | null {
        if (!state) return null;
        const sequence = this.resolveSequence(state.mode);
        const index = sequence.indexOf(this.resolveSequencePosition(state));
        if (index === -1) return null;
        return state.mode ? `Step ${index + 1} of ${sequence.length}` : `Step ${index + 1}`;
    }

    private resolveSequence(mode: CreateGridMode | undefined): readonly SceneStep[] {
        if (mode === CreateGridMode.Quick) return QUICK_STEPS;
        if (mode === CreateGridMode.Ai) return AI_STEPS;
        if (mode === CreateGridMode.Advanced) return ADVANCED_STEPS;
        return PRE_MODE_STEPS;
    }

    private resolveSequencePosition(state: CreateGridWizardState): SceneStep {
        const current = state.currentStep ?? SceneStep.Pair;
        if (current !== SceneStep.Swap) return current;
        return investmentStepForMode(state.mode);
    }
}
