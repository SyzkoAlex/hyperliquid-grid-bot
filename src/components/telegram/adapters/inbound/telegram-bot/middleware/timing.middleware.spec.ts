import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTimingMiddleware } from './timing.middleware';
import { MetricsPort } from '@/core/application/ports/outbound/metrics.port';
import { BotContext } from '../types/bot-context';

function makeCtx(overrides: Partial<BotContext> = {}): BotContext {
    return {
        callbackQuery: undefined,
        message: undefined,
        scene: { current: undefined } as BotContext['scene'],
        ...overrides,
    } as unknown as BotContext;
}

describe('createTimingMiddleware', () => {
    let metrics: {
        observeExchangeApiDuration: ReturnType<typeof vi.fn>;
        observeTelegramHandlerDuration: ReturnType<typeof vi.fn>;
    };
    let next: () => Promise<void>;

    beforeEach(() => {
        metrics = {
            observeExchangeApiDuration: vi.fn(),
            observeTelegramHandlerDuration: vi.fn(),
        };
        next = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    });

    it('should call next and record duration', async () => {
        const middleware = createTimingMiddleware(metrics as MetricsPort);
        const ctx = makeCtx({
            scene: { current: { id: 'create-grid' } } as BotContext['scene'],
        });

        await middleware(ctx, next);

        expect(next).toHaveBeenCalledOnce();
        expect(metrics.observeTelegramHandlerDuration).toHaveBeenCalledOnce();
        const [, duration] = metrics.observeTelegramHandlerDuration.mock.calls[0] as [
            string,
            number,
        ];
        expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('should record duration even when next() throws', async () => {
        (next as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('handler error'));
        const middleware = createTimingMiddleware(metrics as MetricsPort);
        const ctx = makeCtx({
            scene: { current: { id: 'create-grid' } } as BotContext['scene'],
        });

        await expect(middleware(ctx, next)).rejects.toThrow('handler error');
        expect(metrics.observeTelegramHandlerDuration).toHaveBeenCalledWith(
            'create-grid',
            expect.any(Number),
        );
    });

    describe('handler name extraction', () => {
        it('should extract handler name from simple callback data', async () => {
            const middleware = createTimingMiddleware(metrics as MetricsPort);
            const ctx = makeCtx({
                callbackQuery: { data: 'show:balance' } as BotContext['callbackQuery'],
            });

            await middleware(ctx, next);

            expect(metrics.observeTelegramHandlerDuration).toHaveBeenCalledWith(
                'show:balance',
                expect.any(Number),
            );
        });

        it('should strip UUID and page number from callback data', async () => {
            const middleware = createTimingMiddleware(metrics as MetricsPort);
            const ctx = makeCtx({
                callbackQuery: {
                    data: 'view:grid:abc12345-1234-1234-1234-123456789abc:p:1',
                } as BotContext['callbackQuery'],
            });

            await middleware(ctx, next);

            expect(metrics.observeTelegramHandlerDuration).toHaveBeenCalledWith(
                'view:grid',
                expect.any(Number),
            );
        });

        it('should preserve non-dynamic segments after UUID and page stripping', async () => {
            const middleware = createTimingMiddleware(metrics as MetricsPort);
            const ctx = makeCtx({
                callbackQuery: {
                    data: 'view:grid:abc12345-1234-1234-1234-123456789abc:p:3:orders',
                } as BotContext['callbackQuery'],
            });

            await middleware(ctx, next);

            expect(metrics.observeTelegramHandlerDuration).toHaveBeenCalledWith(
                'view:grid:orders',
                expect.any(Number),
            );
        });

        it('should strip trailing page number from callback data', async () => {
            const middleware = createTimingMiddleware(metrics as MetricsPort);
            const ctx = makeCtx({
                callbackQuery: { data: 'grids:active:3' } as BotContext['callbackQuery'],
            });

            await middleware(ctx, next);

            expect(metrics.observeTelegramHandlerDuration).toHaveBeenCalledWith(
                'grids:active',
                expect.any(Number),
            );
        });

        it('should strip UUID from confirm:stop callback data', async () => {
            const middleware = createTimingMiddleware(metrics as MetricsPort);
            const ctx = makeCtx({
                callbackQuery: {
                    data: 'confirm:stop:abc12345-1234-1234-1234-123456789abc',
                } as BotContext['callbackQuery'],
            });

            await middleware(ctx, next);

            expect(metrics.observeTelegramHandlerDuration).toHaveBeenCalledWith(
                'confirm:stop',
                expect.any(Number),
            );
        });

        it('should extract command name from text message', async () => {
            const middleware = createTimingMiddleware(metrics as MetricsPort);
            const ctx = makeCtx({
                message: { text: '/balance' } as BotContext['message'],
            });

            await middleware(ctx, next);

            expect(metrics.observeTelegramHandlerDuration).toHaveBeenCalledWith(
                'balance',
                expect.any(Number),
            );
        });

        it('should strip bot username from command', async () => {
            const middleware = createTimingMiddleware(metrics as MetricsPort);
            const ctx = makeCtx({
                message: { text: '/start@mybot' } as BotContext['message'],
            });

            await middleware(ctx, next);

            expect(metrics.observeTelegramHandlerDuration).toHaveBeenCalledWith(
                'start',
                expect.any(Number),
            );
        });

        it('should not record duration for non-command text message', async () => {
            const middleware = createTimingMiddleware(metrics as MetricsPort);
            const ctx = makeCtx({
                message: { text: 'hello world' } as BotContext['message'],
            });

            await middleware(ctx, next);

            expect(metrics.observeTelegramHandlerDuration).not.toHaveBeenCalled();
        });

        it('should not record duration when callback data normalizes to empty string', async () => {
            const middleware = createTimingMiddleware(metrics as MetricsPort);
            const ctx = makeCtx({
                callbackQuery: { data: 'p' } as BotContext['callbackQuery'],
            });

            await middleware(ctx, next);

            expect(metrics.observeTelegramHandlerDuration).not.toHaveBeenCalled();
        });

        it('should not record duration when no callback, message, or scene', async () => {
            const middleware = createTimingMiddleware(metrics as MetricsPort);
            const ctx = makeCtx();

            await middleware(ctx, next);

            expect(metrics.observeTelegramHandlerDuration).not.toHaveBeenCalled();
        });

        it('should use scene current id when no callback or command', async () => {
            const middleware = createTimingMiddleware(metrics as MetricsPort);
            const ctx = makeCtx({
                scene: { current: { id: 'create-grid' } } as BotContext['scene'],
            });

            await middleware(ctx, next);

            expect(metrics.observeTelegramHandlerDuration).toHaveBeenCalledWith(
                'create-grid',
                expect.any(Number),
            );
        });
    });
});
