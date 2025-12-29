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
    fundingPayment: z.coerce.boolean(),
    liquidationAlert: z.coerce.boolean(),
});

export const telegramFormattingSchema = z.object({
    parseMode: z.enum(['HTML', 'Markdown', 'MarkdownV2']),
    disableWebPagePreview: z.coerce.boolean(),
});

export const telegramRateLimitSchema = z.object({
    maxMessagesPerMinute: z.coerce.number().int().positive(),
});

export const telegramSchema = z.object({
    enabled: z.coerce.boolean(),
    botToken: z.string().min(1),
    allowedChatIds: z.array(z.coerce.number().int()),
    mode: z.enum(['polling', 'webhook']),
    webhook: telegramWebhookSchema,
    notifications: telegramNotificationsSchema,
    formatting: telegramFormattingSchema,
    rateLimit: telegramRateLimitSchema,
});

export type TelegramConfig = z.infer<typeof telegramSchema>;
