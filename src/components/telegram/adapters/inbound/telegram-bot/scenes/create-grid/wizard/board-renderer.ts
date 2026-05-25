import { Injectable } from '@nestjs/common';
import { BotContext } from '../../../types/bot-context';
import { StepView } from './step-view';
import { toInlineKeyboard } from '../../../handlers/inline-keyboard';
import { TelegramParseMode } from '@components/telegram/core/domain/models/telegram-parse-mode';
import { logger } from '@/infra/logger/logger';
import { CreateGridWizardState } from '../create-grid-wizard-state';
import { CreateGridMode } from '../create-grid-mode';
import { WizardSummaryBuilder } from './wizard-summary-builder';

const QUICK_STEP_TOTAL = 5;
const ADVANCED_STEP_TOTAL = 9;

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
        const stepNumber = (state.stepHistory?.length ?? 0) + 1;
        let stepTotal: number | null = null;
        if (state.mode === CreateGridMode.Quick) {
            stepTotal = QUICK_STEP_TOTAL;
        } else if (state.mode === CreateGridMode.Advanced) {
            stepTotal = ADVANCED_STEP_TOTAL;
        }
        return stepTotal !== null ? `Step ${stepNumber} of ${stepTotal}` : `Step ${stepNumber}`;
    }
}
