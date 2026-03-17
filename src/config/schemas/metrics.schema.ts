import { z } from 'zod';

export const metricsSchema = z.object({
    enabled: z.coerce.boolean(),
    path: z.string(),
});

export type MetricsConfig = z.infer<typeof metricsSchema>;
