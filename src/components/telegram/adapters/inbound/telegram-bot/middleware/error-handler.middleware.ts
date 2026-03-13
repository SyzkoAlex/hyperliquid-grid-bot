import { MiddlewareFn } from 'telegraf';
import { createContextLogger } from '@/infra/logger/logger';
import { BotContext } from '../types/bot-context';
import { CommonTexts } from '@components/telegram/core/domain/models/messages/common.texts';

function getTelegramErrorDescription(error: unknown): string {
    if (
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as Record<string, unknown>).response === 'object'
    ) {
        return (error as { response: { description?: string } }).response.description ?? '';
    }
    return '';
}

// Telegram returns this when editMessageText is called with identical content.
function isTelegramNotModifiedError(error: unknown): boolean {
    return getTelegramErrorDescription(error).includes('message is not modified');
}

// Telegram returns this when answerCallbackQuery is called for an expired query
// (e.g. bot was down when user pressed a button, then restarted and received stale updates).
function isStaleCallbackQueryError(error: unknown): boolean {
    return getTelegramErrorDescription(error).includes('query is too old');
}

export function createErrorHandlerMiddleware(): MiddlewareFn<BotContext> {
    const log = createContextLogger('ErrorHandlerMiddleware');

    return async (ctx, next) => {
        try {
            await next();
        } catch (error) {
            if (isTelegramNotModifiedError(error)) {
                await ctx.answerCbQuery().catch(() => void 0);
                return;
            }

            if (isStaleCallbackQueryError(error)) {
                log.warn(
                    'Ignored stale callback query (bot was likely down when button was pressed)',
                );
                return;
            }

            log.error({ error }, 'Unhandled error in bot handler');
            try {
                // Dismiss the button spinner if the error happened inside a callback handler
                if (ctx.callbackQuery) {
                    await ctx.answerCbQuery().catch(() => void 0);
                }
                await ctx.reply(CommonTexts.UNHANDLED_ERROR);
            } catch (replyError) {
                log.error({ error: replyError }, 'Failed to send error reply to user');
            }
        }
    };
}
