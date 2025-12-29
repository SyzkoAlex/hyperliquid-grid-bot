import { z } from 'zod';

export const ordersSchema = z
    .object({
        /** Polling interval for order status sync (ms) */
        pollIntervalMs: z.coerce.number().int().positive().default(10000),
        /** Order restore interval (ms) - how often to restore and cleanup pending orders */
        restoreIntervalMs: z.coerce.number().int().positive().default(1800000), // 30 minutes
        /** Pending order cleanup threshold (ms) - age after which pending orders are cleaned up */
        pendingCleanupThresholdMs: z.coerce.number().int().positive().default(300000), // 5 minutes
        /**
         * History fetch buffer (ms) - time buffer added before oldest order update when fetching history
         * This ensures we don't miss any status changes that happened slightly before the order was last updated
         * Default: 1 hour (3600000 ms)
         */
        historyFetchBufferMs: z.coerce.number().int().positive().default(3600000),
    })
    .optional()
    .default({
        pollIntervalMs: 10000,
        restoreIntervalMs: 1800000,
        pendingCleanupThresholdMs: 300000,
        historyFetchBufferMs: 3600000,
    });

export type OrdersConfig = z.infer<typeof ordersSchema>;
