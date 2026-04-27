import { z } from 'zod';

export const loggingSchema = z.object({
    level: z.enum(['trace', 'debug', 'info', 'warn', 'error']),
    pretty: z.coerce.boolean(),
});

export type LoggingConfig = z.infer<typeof loggingSchema>;
