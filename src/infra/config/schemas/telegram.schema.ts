import { z } from 'zod';

export const telegramWebhookSchema = z.object({
    url: z.string().optional(),
    path: z.string(),
});

export const telegramNotificationsSchema = z.object({
    tradeOpened: z.coerce.boolean(),
    tradeClosed: z.coerce.boolean(),
    stopLoss: z.coerce.boolean(),
    gridStarted: z.coerce.boolean(),
    gridStopped: z.coerce.boolean(),
    errors: z.coerce.boolean(),
});

export const telegramFormattingSchema = z.object({
    parseMode: z.enum(['HTML', 'Markdown', 'MarkdownV2']),
    disableWebPagePreview: z.coerce.boolean(),
});

export const telegramRateLimitSchema = z.object({
    maxMessagesPerMinute: z.coerce.number().int().positive(),
});

export const telegramSessionSchema = z.object({
    ttlSeconds: z.coerce.number().int().positive(),
});

export const telegramSchema = z.object({
    enabled: z.coerce.boolean(),
    botToken: z.string().min(1),
    notificationChatId: z.coerce.number().int(),
    mode: z.enum(['polling', 'webhook']),
    webhook: telegramWebhookSchema,
    notifications: telegramNotificationsSchema,
    formatting: telegramFormattingSchema,
    rateLimit: telegramRateLimitSchema,
    session: telegramSessionSchema,
});

export type TelegramConfig = z.infer<typeof telegramSchema>;
