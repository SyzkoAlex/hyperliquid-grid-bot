import { MiddlewareFn } from 'telegraf';
import { createContextLogger } from '@/infra/logger/logger';
import { BotContext } from '../types/bot-context';
import { EMOJI } from '@components/telegram/core/domain/models/constants/emoji';
import { UsersApiPort } from '@components/users/api/users-api.port';
import { UserStatus } from '@domain/models/user/user-status';
import { CONNECT_ACCOUNT_SCENE_ID } from '../scenes/connect-account/connect-account.scene';

export function createAuthMiddleware(
    allowedUserId: number | undefined,
    usersApi: UsersApiPort,
): MiddlewareFn<BotContext> {
    const log = createContextLogger('AuthMiddleware');

    return async (ctx, next) => {
        const chatId = ctx.chat?.id;

        if (!chatId) {
            log.warn('No chatId in context');
            return;
        }

        // Single-user restriction: only this Telegram user ID can access the bot
        if (allowedUserId && chatId !== allowedUserId) {
            log.warn({ chatId }, 'Access denied: bot restricted to a single user');
            return;
        }

        // Registered user lookup
        const user = await usersApi.findUserByChatId(chatId);

        if (user?.status === UserStatus.Active) {
            ctx.user = user;
            return next();
        }

        // Allow /start for unregistered users to begin onboarding
        const messageText =
            ctx.message && 'text' in ctx.message ? (ctx.message as { text: string }).text : '';
        if (messageText?.startsWith('/start') ?? false) {
            return next();
        }

        // Allow pending users and connect-account scene
        if (user?.status === UserStatus.PendingApproval) {
            ctx.user = user;
            return next();
        }

        // Allow users already in the connect-account scene.
        // ctx.scene is populated by the stage middleware which runs after auth,
        // so we read the current scene directly from the session instead.
        if (ctx.session?.__scenes?.current === CONNECT_ACCOUNT_SCENE_ID) {
            return next();
        }

        log.warn({ chatId }, 'Unauthorized access attempt');
        await ctx.reply(`${EMOJI.FORBIDDEN} Unauthorized. Use /start to connect your account.`);
    };
}
