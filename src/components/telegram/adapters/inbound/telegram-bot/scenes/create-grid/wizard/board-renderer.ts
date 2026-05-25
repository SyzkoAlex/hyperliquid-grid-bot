import { Injectable } from '@nestjs/common';
import { BotContext } from '../../../types/bot-context';
import { StepView } from './step-view';
import { toInlineKeyboard } from '../../../handlers/inline-keyboard';
import { TelegramParseMode } from '@components/telegram/core/domain/models/telegram-parse-mode';
import { logger } from '@/infra/logger/logger';
import { CreateGridWizardState } from '../create-grid-wizard-state';
import { SceneStep } from '../create-grid-scene-step';
import { CreateGridMode } from '../create-grid-mode';
import { formatFiat } from '@components/telegram/core/domain/models/formatters/format-fiat';
import { PriceFormatter } from '@components/telegram/core/domain/models/formatters/price.formatter';

const QUICK_STEP_TOTAL = 5;
const ADVANCED_STEP_TOTAL = 9;

@Injectable()
export class BoardRenderer {
    private readonly logger = logger.child({ context: BoardRenderer.name });

    async render(ctx: BotContext, view: StepView): Promise<void> {
        const state = ctx.session.createGrid;
        const pendingError = state?.pendingError;

        const stepper = this.buildStepper(state);
        const summary = this.buildSummaryFromSession(state);

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

    buildSummaryFromSession(state: CreateGridWizardState | undefined): string {
        if (!state?.stepHistory || state.stepHistory.length === 0) return '';

        const rows: string[] = [];

        for (const step of state.stepHistory) {
            const row = this.buildRowForStep(step, state);
            if (row !== null) {
                rows.push(row);
            }
        }

        return rows.join('\n');
    }

    private buildRowForStep(step: SceneStep, state: CreateGridWizardState): string | null {
        switch (step) {
            case SceneStep.Pair: {
                const symbol = state.symbol;
                if (!symbol) return null;
                const priceStr =
                    state.currentPrice !== undefined ? ` ($${formatFiat(state.currentPrice)})` : '';
                return `✓ <b>Pair</b> · ${symbol}${priceStr}`;
            }
            case SceneStep.Mode: {
                if (!state.mode) return null;
                const modeLabel =
                    state.mode === CreateGridMode.Quick
                        ? 'Quick'
                        : state.mode === CreateGridMode.Advanced
                          ? 'Advanced'
                          : state.mode;
                return `✓ <b>Mode</b> · ${modeLabel}`;
            }
            case SceneStep.Upper: {
                if (state.upperPrice === undefined) return null;
                return `✓ <b>Upper</b> · $${PriceFormatter.format(state.upperPrice)}`;
            }
            case SceneStep.Lower: {
                if (state.lowerPrice === undefined) return null;
                return `✓ <b>Lower</b> · $${PriceFormatter.format(state.lowerPrice)}`;
            }
            case SceneStep.Levels: {
                if (state.levels === undefined) return null;
                return `✓ <b>Levels</b> · ${state.levels}`;
            }
            case SceneStep.Quick:
            case SceneStep.Investment: {
                if (state.totalInvestmentUSDC === undefined) return null;
                return `✓ <b>Investment</b> · $${state.totalInvestmentUSDC} USDC`;
            }
            case SceneStep.StopLoss: {
                if (!state.stopLossEnabled || state.stopLossPrice === undefined) {
                    return `✓ <b>Stop Loss</b> · Disabled`;
                }
                return `✓ <b>Stop Loss</b> · $${PriceFormatter.format(state.stopLossPrice)}`;
            }
            default:
                return null;
        }
    }
}
