import { describe, expect, it, vi } from 'vitest';
import { createAuthMiddleware } from './auth.middleware';
import { BotContext } from '../types/bot-context';
import { EMOJI } from '@components/telegram/core/domain/models/constants/emoji';
import { UserStatus } from '@domain/models/user/user-status';
import { CONNECT_ACCOUNT_SCENE_ID } from '../scenes/connect-account/connect-account.scene';

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
    const middlewareNoRestriction = createAuthMiddleware(undefined, mockUsersApi as any);
    // Single-user restriction to ALLOWED_CHAT_ID
    const middlewareRestricted = createAuthMiddleware(ALLOWED_CHAT_ID, mockUsersApi as any);

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
});
