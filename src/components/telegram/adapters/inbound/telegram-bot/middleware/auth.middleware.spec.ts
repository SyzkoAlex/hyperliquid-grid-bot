import { describe, expect, it, vi } from 'vitest';
import { createAuthMiddleware } from './auth.middleware';
import { BotContext } from '../types/bot-context';
import { EMOJI } from '@components/telegram/core/domain/models/constants/emoji';

const mockLog = { warn: vi.fn() };

vi.mock('@/infra/logger/logger', () => ({
    createContextLogger: () => mockLog,
}));

function makeNext() {
    return vi.fn<() => Promise<void>>();
}

function asNext(fn: ReturnType<typeof makeNext>): () => Promise<void> {
    return fn as unknown as () => Promise<void>;
}

function makeCtx(chatId?: number): BotContext {
    return {
        chat: chatId !== undefined ? { id: chatId } : undefined,
        reply: vi.fn().mockResolvedValue(undefined),
    } as unknown as BotContext;
}

const ALLOWED_CHAT_ID = 123456;

describe('createAuthMiddleware', () => {
    const middleware = createAuthMiddleware(ALLOWED_CHAT_ID);

    it('calls next when chatId matches allowedChatId', async () => {
        const ctx = makeCtx(ALLOWED_CHAT_ID);
        const next = makeNext().mockResolvedValue(undefined);

        await middleware(ctx, asNext(next));

        expect(next).toHaveBeenCalledOnce();
        expect(ctx.reply).not.toHaveBeenCalled();
    });

    it('blocks and replies unauthorized when chatId does not match', async () => {
        const ctx = makeCtx(999999);
        const next = makeNext();

        await middleware(ctx, asNext(next));

        expect(next).not.toHaveBeenCalled();
        expect(ctx.reply).toHaveBeenCalledWith(`${EMOJI.FORBIDDEN} Unauthorized access`);
    });

    it('blocks and replies unauthorized when chat is undefined', async () => {
        const ctx = makeCtx(undefined);
        const next = makeNext();

        await middleware(ctx, asNext(next));

        expect(next).not.toHaveBeenCalled();
        expect(ctx.reply).toHaveBeenCalledWith(`${EMOJI.FORBIDDEN} Unauthorized access`);
    });

    it('logs a warning on unauthorized access', async () => {
        mockLog.warn.mockClear();
        const ctx = makeCtx(999999);
        const next = makeNext();

        await middleware(ctx, asNext(next));

        expect(mockLog.warn).toHaveBeenCalledOnce();
    });
});
