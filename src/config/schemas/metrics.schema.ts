import { z } from 'zod';

export const metricsSchema = z.object({
    enabled: z.coerce.boolean(),
    port: z.coerce.number().int().positive(),
    path: z.string(),
});

export type MetricsConfig = z.infer<typeof metricsSchema>;
