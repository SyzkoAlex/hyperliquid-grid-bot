import { z } from 'zod';

export const swapSchema = z.object({
    initialSlippageCapPct: z.coerce.number().positive().max(0.1),
    retrySlippageCapPct: z.coerce.number().positive().max(0.1),
});

export type SwapConfig = z.infer<typeof swapSchema>;
