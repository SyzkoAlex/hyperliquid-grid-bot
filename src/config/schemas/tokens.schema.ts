import { z } from 'zod';

export const tokensSchema = z.object({
    topSize: z.coerce.number().int().positive(),
    refreshIntervalMs: z.coerce.number().int().positive(),
    cacheTtlSeconds: z.coerce.number().int().positive(),
    lockTtlMs: z.coerce.number().int().positive(),
});

export type TokensConfig = z.infer<typeof tokensSchema>;
