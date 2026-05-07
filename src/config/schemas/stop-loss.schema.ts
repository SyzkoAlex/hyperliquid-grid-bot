import { z } from 'zod';

export const stopLossSchema = z.object({
    initialSlippageCapPct: z.coerce.number().positive(),
    retrySlippageCapPct: z.coerce.number().positive(),
});

export type StopLossConfig = z.infer<typeof stopLossSchema>;
