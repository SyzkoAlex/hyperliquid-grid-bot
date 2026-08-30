import { z } from 'zod';
import { coerceBoolean } from './coerce-boolean';

export const telegramSessionSchema = z.object({
    ttlSeconds: z.coerce.number().int().positive(),
    keyPrefix: z.string().min(1),
});

export const telegramPaginationSchema = z.object({
    activePageSize: z.coerce.number().int().positive(),
    stoppedPageSize: z.coerce.number().int().positive(),
});

export const telegramSchema = z.object({
    enabled: coerceBoolean(),
    botToken: z.string().min(1),
    // SOCKS proxy for Telegram API traffic only (e.g. socks5h://proxy:1080);
    // empty/unset = direct connection
    proxyUrl: z.string().optional(),
    allowedUserId: z.coerce.number().int().optional(),
    session: telegramSessionSchema,
    pagination: telegramPaginationSchema,
    botLockTtlMs: z.coerce.number().int().positive(),
});

export type TelegramConfig = z.infer<typeof telegramSchema>;
