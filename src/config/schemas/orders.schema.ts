import { z } from 'zod';

export const ordersSchema = z.object({
    pollIntervalMs: z.coerce.number().int().positive(),
    recoveryIntervalMs: z.coerce.number().int().positive(),
    pendingCleanupThresholdMs: z.coerce.number().int().positive(),
});

export type OrdersConfig = z.infer<typeof ordersSchema>;
