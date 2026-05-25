import { Injectable } from '@nestjs/common';
import { BotContext } from '../../../types/bot-context';
import { StepView } from './step-view';
import { SummaryRow } from './summary-row';
import { toInlineKeyboard } from '../../../handlers/inline-keyboard';
import { TelegramParseMode } from '@components/telegram/core/domain/models/telegram-parse-mode';
import { logger } from '@/infra/logger/logger';

@Injectable()
export class BoardRenderer {
    private readonly logger = logger.child({ context: BoardRenderer.name });

    async render(ctx: BotContext, view: StepView): Promise<void> {
        const state = ctx.session.createGrid;
        const pendingError = state?.pendingError;
        const body = pendingError ? `${pendingError}\n\n${view.body}` : view.body;
        const text = this.renderSummary(view.summaryRows) + body;
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

    private renderSummary(rows?: SummaryRow[]): string {
        if (!rows || rows.length === 0) return '';
        return rows.map((r) => `✓ <b>${r.label}</b> · ${r.value}`).join('\n') + '\n\n';
    }
}
