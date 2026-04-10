import { MiddlewareFn } from 'telegraf';
import { BotContext } from '../types/bot-context';
import { MetricsPort } from '@/core/application/ports/outbound/metrics.port';
import { startTimer } from '@/infra/metrics/timer';

export function createTimingMiddleware(metrics: MetricsPort): MiddlewareFn<BotContext> {
    return async (ctx, next) => {
        const stop = startTimer();
        try {
            await next();
        } finally {
            const handler = extractHandlerName(ctx);
            if (handler !== null) {
                metrics.observeTelegramHandlerDuration(handler, stop());
            }
        }
    };
}

function extractHandlerName(ctx: BotContext): string | null {
    if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
        return normalizeCallbackData(ctx.callbackQuery.data) || null;
    }

    if (ctx.message && 'text' in ctx.message) {
        const text = ctx.message.text;
        if (text.startsWith('/')) {
            return text.split(/\s/)[0].slice(1).split('@')[0];
        }
    }

    if (ctx.scene?.current?.id) {
        return ctx.scene.current.id;
    }

    return null;
}

function normalizeCallbackData(data: string): string {
    return data
        .split(':')
        .filter((s) => s !== '' && s !== 'p' && !/^[0-9a-f-]{36}$/i.test(s) && !/^\d+$/.test(s))
        .join(':');
}
