import { z } from 'zod';

export const hyperliquidSchema = z.object({
    apiUrl: z.string().url(),
    testnet: z.coerce.boolean().default(false),
    websocketUrl: z.string().url(),
    agentKeyEncryptionKey: z
        .string()
        .length(64, 'Must be 64 hex chars (32 bytes)')
        .refine(
            (v) => v !== '0'.repeat(64) && v !== '0'.repeat(63) + '1',
            'Weak/placeholder encryption key is not allowed',
        )
        .optional(), // 32 bytes hex; required at runtime when agent wallets are used
    requestTimeout: z.coerce.number().int().positive(),
    minOrderNotional: z.coerce.number().positive(),
    sellSizeBuffer: z.coerce.number().min(0).max(0.1),
    websocket: z.object({
        maxReconnectAttempts: z.coerce.number().int().positive(),
        baseReconnectDelay: z.coerce.number().int().positive(),
        keepAliveIntervalMs: z.coerce.number().int().positive(),
    }),
});

export type HyperliquidConfig = z.infer<typeof hyperliquidSchema>;
