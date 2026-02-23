import { MiddlewareFn } from 'telegraf';
import { createContextLogger } from '@/infra/logger/logger';
import { BotContext } from '../types/bot-context';
import { EMOJI } from '@components/telegram/core/domain/models/constants/emoji.constants';

// Telegram returns this when editMessageText is called with identical content.
// It is not a real error — the message is already correct.
function isTelegramNotModifiedError(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as Record<string, unknown>).response === 'object' &&
        ((error as { response: { description?: string } }).response.description ?? '').includes(
            'message is not modified',
        )
    );
}

export function createErrorHandlerMiddleware(): MiddlewareFn<BotContext> {
    const log = createContextLogger('ErrorHandlerMiddleware');

    return async (ctx, next) => {
        try {
            await next();
        } catch (error) {
            if (isTelegramNotModifiedError(error)) {
                // Silently swallow — message already shows the correct content (e.g. double-click)
                await ctx.answerCbQuery().catch(() => void 0);
                return;
            }

            log.error({ error }, 'Unhandled error in bot handler');
            try {
                // Dismiss the button spinner if the error happened inside a callback handler
                if (ctx.callbackQuery) {
                    await ctx.answerCbQuery().catch(() => void 0);
                }
                await ctx.reply(`${EMOJI.ERROR} Something went wrong. Please try again later.`);
            } catch (replyError) {
                log.error({ error: replyError }, 'Failed to send error reply to user');
            }
        }
    };
}
