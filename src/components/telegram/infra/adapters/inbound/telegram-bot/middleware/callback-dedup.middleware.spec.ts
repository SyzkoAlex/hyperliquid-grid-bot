import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCallbackDedupMiddleware } from './callback-dedup.middleware';
import { createErrorHandlerMiddleware } from './error-handler.middleware';
import { BotContext } from '../types/bot-context';

vi.mock('@infra/logger/logger', () => ({
    createContextLogger: () => ({ error: vi.fn() }),
}));

function makeNext() {
    return vi.fn<[], Promise<void>>();
}

function asNext(fn: ReturnType<typeof makeNext>): () => Promise<void> {
    return fn as unknown as () => Promise<void>;
}

function makeCtx(overrides: Partial<BotContext> = {}): BotContext {
    return {
        chat: { id: 42 },
        callbackQuery: { data: 'action:123', message: { message_id: 1 } },
        answerCbQuery: vi.fn().mockResolvedValue(undefined),
        reply: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    } as unknown as BotContext;
}

describe('createCallbackDedupMiddleware', () => {
    let next: ReturnType<typeof makeNext>;

    beforeEach(() => {
        next = makeNext();
    });

    it('passes through non-callback updates', async () => {
        const middleware = createCallbackDedupMiddleware();
        next.mockResolvedValue(undefined);
        const ctx = makeCtx({ callbackQuery: undefined });

        await middleware(ctx, asNext(next));

        expect(next).toHaveBeenCalledOnce();
        expect(ctx.answerCbQuery).not.toHaveBeenCalled();
    });

    it('allows first callback through', async () => {
        const middleware = createCallbackDedupMiddleware();
        next.mockResolvedValue(undefined);
        const ctx = makeCtx();

        await middleware(ctx, asNext(next));

        expect(next).toHaveBeenCalledOnce();
        expect(ctx.answerCbQuery).not.toHaveBeenCalled();
    });

    it('blocks duplicate callback while first is in flight', async () => {
        const middleware = createCallbackDedupMiddleware();
        const ctx1 = makeCtx();
        const ctx2 = makeCtx();

        let resolveFirst!: () => void;
        next.mockImplementationOnce(
            () =>
                new Promise<void>((resolve) => {
                    resolveFirst = resolve;
                }),
        ).mockResolvedValue(undefined);

        const first = middleware(ctx1, asNext(next));

        await middleware(ctx2, asNext(next));

        expect(ctx2.answerCbQuery).toHaveBeenCalledWith('Processing...');
        expect(next).toHaveBeenCalledTimes(1);

        resolveFirst();
        await first;
    });

    it('does not propagate answerCbQuery failure when blocking duplicate', async () => {
        const middleware = createCallbackDedupMiddleware();
        const ctx1 = makeCtx();
        const ctx2 = makeCtx({
            answerCbQuery: vi.fn().mockRejectedValue(new Error('query too old')),
        } as Partial<BotContext>);

        let resolveFirst!: () => void;
        next.mockImplementationOnce(
            () =>
                new Promise<void>((resolve) => {
                    resolveFirst = resolve;
                }),
        );

        const first = middleware(ctx1, asNext(next));
        await expect(middleware(ctx2, asNext(next))).resolves.toBeUndefined();

        resolveFirst();
        await first;
    });

    it('does not conflate same action from different messages in same chat', async () => {
        const middleware = createCallbackDedupMiddleware();
        const ctx1 = makeCtx({
            callbackQuery: { data: 'action:123', message: { message_id: 1 } },
        } as Partial<BotContext>);
        const ctx2 = makeCtx({
            callbackQuery: { data: 'action:123', message: { message_id: 2 } },
        } as Partial<BotContext>);

        let resolveFirst!: () => void;
        next.mockImplementationOnce(
            () =>
                new Promise<void>((r) => {
                    resolveFirst = r;
                }),
        ).mockResolvedValueOnce(undefined);

        const first = middleware(ctx1, asNext(next));
        await middleware(ctx2, asNext(next));

        expect(next).toHaveBeenCalledTimes(2);
        expect(ctx2.answerCbQuery).not.toHaveBeenCalled();

        resolveFirst();
        await first;
    });

    it('cleans up after handler completes (allows retry)', async () => {
        const middleware = createCallbackDedupMiddleware();
        next.mockResolvedValue(undefined);
        const ctx = makeCtx();

        await middleware(ctx, asNext(next));
        await middleware(ctx, asNext(next));

        expect(next).toHaveBeenCalledTimes(2);
    });

    it('cleans up after handler throws', async () => {
        const middleware = createCallbackDedupMiddleware();
        const ctx = makeCtx();

        next.mockRejectedValueOnce(new Error('boom'));
        await expect(middleware(ctx, asNext(next))).rejects.toThrow('boom');

        next.mockResolvedValueOnce(undefined);
        await middleware(ctx, asNext(next));

        expect(next).toHaveBeenCalledTimes(2);
    });

    it('allows different callbacks concurrently', async () => {
        const middleware = createCallbackDedupMiddleware();
        const ctx1 = makeCtx({
            callbackQuery: { data: 'action:1', message: { message_id: 1 } },
        } as Partial<BotContext>);
        const ctx2 = makeCtx({
            callbackQuery: { data: 'action:2', message: { message_id: 1 } },
        } as Partial<BotContext>);

        let resolveFirst!: () => void;
        let resolveSecond!: () => void;
        next.mockImplementationOnce(
            () =>
                new Promise<void>((r) => {
                    resolveFirst = r;
                }),
        ).mockImplementationOnce(
            () =>
                new Promise<void>((r) => {
                    resolveSecond = r;
                }),
        );

        const first = middleware(ctx1, asNext(next));
        const second = middleware(ctx2, asNext(next));

        resolveFirst();
        resolveSecond();

        await Promise.all([first, second]);

        expect(next).toHaveBeenCalledTimes(2);
        expect(ctx1.answerCbQuery).not.toHaveBeenCalled();
        expect(ctx2.answerCbQuery).not.toHaveBeenCalled();
    });

    describe('integration with error-handler middleware', () => {
        it('error-handler catches error re-thrown by dedup and replies to user', async () => {
            const errorHandler = createErrorHandlerMiddleware();
            const dedup = createCallbackDedupMiddleware();

            // Chain: errorHandler → dedup → handler
            const chain = async (ctx: BotContext): Promise<void> => {
                await errorHandler(ctx, () => dedup(ctx, asNext(next)) as Promise<void>);
            };

            const ctx = makeCtx();
            next.mockRejectedValue(new Error('exchange API down'));

            await expect(chain(ctx)).resolves.toBeUndefined();

            expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Something went wrong'));
        });
    });
});
