import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createErrorHandlerMiddleware } from './error-handler.middleware';
import { BotContext } from '../types/bot-context';
import { EMOJI } from '@components/telegram/core/domain/models/constants/emoji';

const mockLog = { error: vi.fn() };

vi.mock('@/infra/logger/logger', () => ({
    createContextLogger: () => mockLog,
}));

function makeNext() {
    return vi.fn<[], Promise<void>>();
}

function asNext(fn: ReturnType<typeof makeNext>): () => Promise<void> {
    return fn as unknown as () => Promise<void>;
}

function makeCtx(overrides: Partial<BotContext> = {}): BotContext {
    return {
        reply: vi.fn().mockResolvedValue(undefined),
        callbackQuery: undefined,
        answerCbQuery: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    } as unknown as BotContext;
}

describe('createErrorHandlerMiddleware', () => {
    const middleware = createErrorHandlerMiddleware();

    beforeEach(() => {
        mockLog.error.mockClear();
    });

    it('passes through when no error', async () => {
        const ctx = makeCtx();
        const next = makeNext().mockResolvedValue(undefined);

        await middleware(ctx, asNext(next));

        expect(next).toHaveBeenCalledOnce();
        expect(ctx.reply).not.toHaveBeenCalled();
        expect(mockLog.error).not.toHaveBeenCalled();
    });

    it('catches error, logs it, and replies to user', async () => {
        const ctx = makeCtx();
        const next = makeNext().mockRejectedValue(new Error('handler error'));

        await expect(middleware(ctx, asNext(next))).resolves.toBeUndefined();

        expect(mockLog.error).toHaveBeenCalledOnce();
        expect(ctx.reply).toHaveBeenCalledWith(
            `${EMOJI.ERROR} Something went wrong. Please try again later.`,
        );
    });

    it('answers callback query spinner before replying when error is in a callback handler', async () => {
        const ctx = makeCtx({ callbackQuery: { data: 'some:action' } } as Partial<BotContext>);
        const next = makeNext().mockRejectedValue(new Error('handler error'));

        await middleware(ctx, asNext(next));

        expect(ctx.answerCbQuery).toHaveBeenCalledOnce();
        expect(ctx.reply).toHaveBeenCalledOnce();
    });

    it('does not call answerCbQuery for non-callback errors', async () => {
        const ctx = makeCtx();
        const next = makeNext().mockRejectedValue(new Error('handler error'));

        await middleware(ctx, asNext(next));

        expect(ctx.answerCbQuery).not.toHaveBeenCalled();
    });

    it('silently swallows "message is not modified" Telegram error', async () => {
        const ctx = makeCtx({ callbackQuery: { data: 'some:action' } } as Partial<BotContext>);
        const telegramError = {
            response: { description: 'Bad Request: message is not modified' },
        };
        const next = makeNext().mockRejectedValue(telegramError);

        await expect(middleware(ctx, asNext(next))).resolves.toBeUndefined();

        expect(mockLog.error).not.toHaveBeenCalled();
        expect(ctx.reply).not.toHaveBeenCalled();
        expect(ctx.answerCbQuery).toHaveBeenCalledOnce();
    });

    it('handles reply failure gracefully and logs both errors', async () => {
        const ctx = makeCtx();
        vi.mocked(ctx.reply).mockRejectedValue(new Error('telegram API down'));
        const next = makeNext().mockRejectedValue(new Error('handler error'));

        await expect(middleware(ctx, asNext(next))).resolves.toBeUndefined();

        expect(mockLog.error).toHaveBeenCalledTimes(2);
    });
});
