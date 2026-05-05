import { z } from 'zod';
import { coerceBoolean } from './coerce-boolean';

export const metricsSchema = z.object({
    enabled: coerceBoolean(),
    path: z.string(),
});

export type MetricsConfig = z.infer<typeof metricsSchema>;
