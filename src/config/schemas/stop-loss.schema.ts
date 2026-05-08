import { z } from 'zod';

export const stopLossSchema = z.object({
    initialSlippageCapPct: z.coerce.number().positive(),
    retrySlippageCapPct: z.coerce.number().positive(),
    confirmDurationMs: z.coerce.number().int().positive(),
    penetrationPct: z.coerce.number().positive(),
    breachTtlSeconds: z.coerce.number().int().positive(),
});

export type StopLossConfig = z.infer<typeof stopLossSchema>;
