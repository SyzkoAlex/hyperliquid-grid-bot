import { MiddlewareFn } from 'telegraf';
import { createContextLogger } from '@/infra/logger/logger';
import { BotContext } from '../types/bot-context';
import { EMOJI } from '@components/telegram/core/domain/models/constants/emoji';

export function createAuthMiddleware(allowedChatId: number): MiddlewareFn<BotContext> {
    const log = createContextLogger('AuthMiddleware');

    return async (ctx, next) => {
        const chatId = ctx.chat?.id;

        if (!chatId || chatId !== allowedChatId) {
            log.warn({ chatId, expected: allowedChatId }, 'Unauthorized access attempt');
            await ctx.reply(`${EMOJI.FORBIDDEN} Unauthorized access`);
            return;
        }

        return next();
    };
}
