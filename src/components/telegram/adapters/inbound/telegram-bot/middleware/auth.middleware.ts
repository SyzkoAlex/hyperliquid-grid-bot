import { MiddlewareFn } from 'telegraf';
import { createContextLogger } from '@/infra/logger/logger';
import { BotContext } from '../types/bot-context';
import { EMOJI } from '@components/telegram/core/domain/models/constants/emoji';
import { UsersApiPort } from '@components/users/api/users-api.port';
import { UserStatus } from '@domain/models/user/user-status';
import { CONNECT_ACCOUNT_SCENE_ID } from '../scenes/connect-account/connect-account.scene';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels';
import { TelegramAction } from '@components/telegram/core/domain/models/telegram-action';

// Public entry points — unregistered users may reach these so the handlers can
// render a "connect first" explanation card.
const PUBLIC_TEXT_ENTRIES: ReadonlySet<string> = new Set([
    '/balance',
    '/grids',
    '/help',
    BUTTON_LABELS.BALANCE,
    BUTTON_LABELS.CREATE_GRID,
    BUTTON_LABELS.GRIDS,
    BUTTON_LABELS.STOPPED_GRIDS,
    BUTTON_LABELS.HELP,
    BUTTON_LABELS.SETTINGS,
]);

// Public callback actions (inline-button presses) accessible without registration.
const PUBLIC_CALLBACK_ACTIONS: ReadonlySet<string> = new Set([
    TelegramAction.ShowBalance,
    TelegramAction.CreateGrid,
    TelegramAction.ConnectAccount,
    TelegramAction.ShowHelp,
    TelegramAction.ListGrids,
    TelegramAction.ShowSettings,
]);

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

        // Always propagate the user to ctx so downstream handlers have access,
        // regardless of which branch grants access below.
        if (user) {
            ctx.user = user;
        }

        if (user?.status === UserStatus.Active) {
            return next();
        }

        // Allow /start for unregistered users to begin onboarding
        const messageText =
            ctx.message && 'text' in ctx.message ? (ctx.message as { text: string }).text : '';
        if (messageText.startsWith('/start')) {
            return next();
        }

        if (messageText && PUBLIC_TEXT_ENTRIES.has(messageText)) {
            return next();
        }

        const callbackData =
            ctx.callbackQuery && 'data' in ctx.callbackQuery
                ? (ctx.callbackQuery as { data: string }).data
                : undefined;
        if (callbackData && PUBLIC_CALLBACK_ACTIONS.has(callbackData)) {
            return next();
        }

        // Allow pending users and connect-account scene
        if (user?.status === UserStatus.PendingApproval) {
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
