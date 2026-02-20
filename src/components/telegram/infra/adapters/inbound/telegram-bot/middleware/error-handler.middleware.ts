import { MiddlewareFn } from 'telegraf';
import { createContextLogger } from '@infra/logger/logger';
import { BotContext } from '../types/bot-context';
import { EMOJI } from '@components/telegram/domain/models/constants/emoji.constants';

export function createErrorHandlerMiddleware(): MiddlewareFn<BotContext> {
    const log = createContextLogger('ErrorHandlerMiddleware');

    return async (ctx, next) => {
        try {
            await next();
        } catch (error) {
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
