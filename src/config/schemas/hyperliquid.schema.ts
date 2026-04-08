import { z } from 'zod';

export const hyperliquidSchema = z.object({
    apiUrl: z.string().url(),
    websocketUrl: z.string().url(),
    privateKey: z.string().min(1),
    accountAddress: z.string().min(1),
    testnet: z.coerce.boolean(),
    requestTimeout: z.coerce.number().int().positive(),
    maxRetries: z.coerce.number().int().min(0),
    retryDelay: z.coerce.number().int().positive(),
    minOrderNotional: z.coerce.number().positive(),
    sellSizeBuffer: z.coerce.number().min(0).max(0.1),
    websocket: z.object({
        maxReconnectAttempts: z.coerce.number().int().positive(),
        baseReconnectDelay: z.coerce.number().int().positive(),
    }),
});

export type HyperliquidConfig = z.infer<typeof hyperliquidSchema>;
