import { describe, expect, it, vi } from 'vitest';
import { createAuthMiddleware } from './auth.middleware';
import { BotContext } from '../types/bot-context';
import { EMOJI } from '@components/telegram/core/domain/models/constants/emoji';
import { UserStatus } from '@domain/models/user/user-status';
import { CONNECT_ACCOUNT_SCENE_ID } from '../scenes/connect-account/connect-account.scene';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels';
import { TelegramAction } from '@components/telegram/core/domain/models/telegram-action';
import { UsersApiPort } from '@components/users/api/users-api.port';

const mockLog = vi.hoisted(() => {
    const log = {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        child: (): unknown => log,
    };
    return log;
});

vi.mock('@/infra/logger/logger', () => ({
    createContextLogger: () => mockLog,
    logger: mockLog,
}));

function makeNext() {
    return vi.fn<() => Promise<void>>();
}

function asNext(fn: ReturnType<typeof makeNext>): () => Promise<void> {
    return fn as unknown as () => Promise<void>;
}

function makeCtx(chatId?: number, messageText?: string): BotContext {
    return {
        chat: chatId !== undefined ? { id: chatId } : undefined,
        reply: vi.fn().mockResolvedValue(undefined),
        message: messageText !== undefined ? { text: messageText } : undefined,
        scene: { current: null },
    } as unknown as BotContext;
}

const ALLOWED_CHAT_ID = 123456;
const ACTIVE_USER = { status: UserStatus.Active, accountAddress: '0xabc' };

describe('createAuthMiddleware', () => {
    const mockUsersApi = {
        findUserByChatId: vi.fn().mockResolvedValue(null),
    };
    // No single-user restriction — all users go through the full auth flow
    const middlewareNoRestriction = createAuthMiddleware(
        undefined,
        mockUsersApi as unknown as UsersApiPort,
    );
    // Single-user restriction to ALLOWED_CHAT_ID
    const middlewareRestricted = createAuthMiddleware(
        ALLOWED_CHAT_ID,
        mockUsersApi as unknown as UsersApiPort,
    );

    it('calls next when chatId matches allowedChatId (allowed user bypass)', async () => {
        mockUsersApi.findUserByChatId.mockResolvedValue(ACTIVE_USER);
        const ctx = makeCtx(ALLOWED_CHAT_ID);
        const next = makeNext().mockResolvedValue(undefined);

        await middlewareRestricted(ctx, asNext(next));

        expect(next).toHaveBeenCalledOnce();
        expect(ctx.reply).not.toHaveBeenCalled();
    });

    it('blocks chatId that does not match allowedUserId restriction', async () => {
        const ctx = makeCtx(999999, 'hello');
        const next = makeNext();

        await middlewareRestricted(ctx, asNext(next));

        expect(next).not.toHaveBeenCalled();
    });

    it('calls next for active registered user when no restriction set', async () => {
        mockUsersApi.findUserByChatId.mockResolvedValue(ACTIVE_USER);
        const ctx = makeCtx(999999);
        const next = makeNext().mockResolvedValue(undefined);

        await middlewareNoRestriction(ctx, asNext(next));

        expect(next).toHaveBeenCalledOnce();
        expect(ctx.reply).not.toHaveBeenCalled();
    });

    it('allows /start for unregistered users when no restriction set', async () => {
        mockUsersApi.findUserByChatId.mockResolvedValue(null);
        const ctx = makeCtx(999999, '/start');
        const next = makeNext().mockResolvedValue(undefined);

        await middlewareNoRestriction(ctx, asNext(next));

        expect(next).toHaveBeenCalledOnce();
    });

    it('blocks and replies unauthorized when unregistered user sends non-start message', async () => {
        mockUsersApi.findUserByChatId.mockResolvedValue(null);
        const ctx = makeCtx(999999, 'hello');
        const next = makeNext();

        await middlewareNoRestriction(ctx, asNext(next));

        expect(next).not.toHaveBeenCalled();
        expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining(EMOJI.FORBIDDEN));
    });

    it('blocks and replies unauthorized when chat is undefined', async () => {
        const ctx = makeCtx(undefined);
        const next = makeNext();

        await middlewareNoRestriction(ctx, asNext(next));

        expect(next).not.toHaveBeenCalled();
    });

    it('logs a warning on unauthorized access', async () => {
        mockLog.warn.mockClear();
        mockUsersApi.findUserByChatId.mockResolvedValue(null);
        const ctx = makeCtx(999999, 'hello');
        const next = makeNext();

        await middlewareNoRestriction(ctx, asNext(next));

        expect(mockLog.warn).toHaveBeenCalled();
    });

    it('allows unregistered user who is already in connect-account scene', async () => {
        mockUsersApi.findUserByChatId.mockResolvedValue(null);
        const ctx = makeCtx(999999, '0xabc');
        (ctx as any).session = { __scenes: { current: CONNECT_ACCOUNT_SCENE_ID } };
        const next = makeNext().mockResolvedValue(undefined);

        await middlewareNoRestriction(ctx, asNext(next));

        expect(next).toHaveBeenCalledOnce();
        expect(ctx.reply).not.toHaveBeenCalled();
    });

    it('allows /balance for unregistered users', async () => {
        mockUsersApi.findUserByChatId.mockResolvedValue(null);
        const ctx = makeCtx(999999, '/balance');
        const next = makeNext().mockResolvedValue(undefined);

        await middlewareNoRestriction(ctx, asNext(next));

        expect(next).toHaveBeenCalledOnce();
        expect(ctx.reply).not.toHaveBeenCalled();
    });

    it('allows BUTTON_LABELS.BALANCE hears for unregistered users', async () => {
        mockUsersApi.findUserByChatId.mockResolvedValue(null);
        const ctx = makeCtx(999999, BUTTON_LABELS.BALANCE);
        const next = makeNext().mockResolvedValue(undefined);

        await middlewareNoRestriction(ctx, asNext(next));

        expect(next).toHaveBeenCalledOnce();
        expect(ctx.reply).not.toHaveBeenCalled();
    });

    it('allows BUTTON_LABELS.CREATE_GRID hears for unregistered users', async () => {
        mockUsersApi.findUserByChatId.mockResolvedValue(null);
        const ctx = makeCtx(999999, BUTTON_LABELS.CREATE_GRID);
        const next = makeNext().mockResolvedValue(undefined);

        await middlewareNoRestriction(ctx, asNext(next));

        expect(next).toHaveBeenCalledOnce();
        expect(ctx.reply).not.toHaveBeenCalled();
    });

    it('allows ShowBalance callback for unregistered users', async () => {
        mockUsersApi.findUserByChatId.mockResolvedValue(null);
        const ctx = makeCtx(999999);
        (ctx as any).callbackQuery = { data: TelegramAction.ShowBalance };
        const next = makeNext().mockResolvedValue(undefined);

        await middlewareNoRestriction(ctx, asNext(next));

        expect(next).toHaveBeenCalledOnce();
        expect(ctx.reply).not.toHaveBeenCalled();
    });

    it('allows CreateGrid callback for unregistered users', async () => {
        mockUsersApi.findUserByChatId.mockResolvedValue(null);
        const ctx = makeCtx(999999);
        (ctx as any).callbackQuery = { data: TelegramAction.CreateGrid };
        const next = makeNext().mockResolvedValue(undefined);

        await middlewareNoRestriction(ctx, asNext(next));

        expect(next).toHaveBeenCalledOnce();
        expect(ctx.reply).not.toHaveBeenCalled();
    });

    it('allows ConnectAccount callback for unregistered users', async () => {
        mockUsersApi.findUserByChatId.mockResolvedValue(null);
        const ctx = makeCtx(999999);
        (ctx as any).callbackQuery = { data: TelegramAction.ConnectAccount };
        const next = makeNext().mockResolvedValue(undefined);

        await middlewareNoRestriction(ctx, asNext(next));

        expect(next).toHaveBeenCalledOnce();
        expect(ctx.reply).not.toHaveBeenCalled();
    });

    it('allows ShowHelp callback for unregistered users', async () => {
        mockUsersApi.findUserByChatId.mockResolvedValue(null);
        const ctx = makeCtx(999999);
        (ctx as any).callbackQuery = { data: TelegramAction.ShowHelp };
        const next = makeNext().mockResolvedValue(undefined);

        await middlewareNoRestriction(ctx, asNext(next));

        expect(next).toHaveBeenCalledOnce();
        expect(ctx.reply).not.toHaveBeenCalled();
    });

    it('sets ctx.user for PendingApproval user reaching a PUBLIC_CALLBACK_ACTION', async () => {
        const pendingUser = { status: UserStatus.PendingApproval, accountAddress: '0xpending' };
        mockUsersApi.findUserByChatId.mockResolvedValue(pendingUser);
        const ctx = makeCtx(999999);
        (ctx as any).callbackQuery = { data: TelegramAction.ConnectAccount };
        const next = makeNext().mockResolvedValue(undefined);

        await middlewareNoRestriction(ctx, asNext(next));

        expect(next).toHaveBeenCalledOnce();
        expect(ctx.user).toBe(pendingUser);
    });

    it('sets ctx.user for PendingApproval user reaching a PUBLIC_TEXT_ENTRY', async () => {
        const pendingUser = { status: UserStatus.PendingApproval, accountAddress: '0xpending' };
        mockUsersApi.findUserByChatId.mockResolvedValue(pendingUser);
        const ctx = makeCtx(999999, BUTTON_LABELS.BALANCE);
        const next = makeNext().mockResolvedValue(undefined);

        await middlewareNoRestriction(ctx, asNext(next));

        expect(next).toHaveBeenCalledOnce();
        expect(ctx.user).toBe(pendingUser);
    });

    it('sets ctx.user for active user', async () => {
        mockUsersApi.findUserByChatId.mockResolvedValue(ACTIVE_USER);
        const ctx = makeCtx(999999);
        const next = makeNext().mockResolvedValue(undefined);

        await middlewareNoRestriction(ctx, asNext(next));

        expect(next).toHaveBeenCalledOnce();
        expect(ctx.user).toBe(ACTIVE_USER);
    });
});
