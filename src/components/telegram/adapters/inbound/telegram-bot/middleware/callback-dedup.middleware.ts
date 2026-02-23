import { MiddlewareFn } from 'telegraf';
import { BotContext } from '../types/bot-context';

export function createCallbackDedupMiddleware(): MiddlewareFn<BotContext> {
    // Set<string> — entries are always removed by the finally block, no stale cleanup needed
    const inFlight = new Set<string>();

    return async (ctx, next) => {
        if (!ctx.callbackQuery) {
            return next();
        }

        const chatId = ctx.chat?.id;
        const data = 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : undefined;

        if (!chatId || !data) {
            return next();
        }

        // message_id disambiguates same action on two different messages in the same chat
        const messageId =
            ctx.callbackQuery.message?.message_id ?? ctx.callbackQuery.inline_message_id;

        const key = `${chatId}:${String(messageId)}:${data}`;

        if (inFlight.has(key)) {
            await ctx.answerCbQuery('Processing...').catch(() => void 0);
            return;
        }

        inFlight.add(key);
        try {
            await next();
        } finally {
            inFlight.delete(key);
        }
    };
}
