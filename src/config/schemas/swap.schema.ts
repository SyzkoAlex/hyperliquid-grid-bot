import { z } from 'zod';

export const swapSchema = z
    .object({
        initialL2BufferPct: z.coerce.number().positive().max(0.1),
        retryL2BufferPct: z.coerce.number().positive().max(0.1),
    })
    .refine((s) => s.retryL2BufferPct >= s.initialL2BufferPct, {
        message: 'retryL2BufferPct must be >= initialL2BufferPct',
    });

export type SwapConfig = z.infer<typeof swapSchema>;
