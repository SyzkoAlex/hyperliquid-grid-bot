import { z } from 'zod';
import { coerceBoolean } from './coerce-boolean';

export const loggingSchema = z.object({
    level: z.enum(['trace', 'debug', 'info', 'warn', 'error']),
    pretty: coerceBoolean(),
});

export type LoggingConfig = z.infer<typeof loggingSchema>;
