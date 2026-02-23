import { z } from 'zod';

export const appSchema = z.object({
    name: z.string(),
    port: z.coerce.number().int().positive(),
    host: z.string(),
});

export type AppConfig = z.infer<typeof appSchema>;
