import { z } from 'zod';

export const databaseSchema = z.object({
    host: z.string().min(1),
    port: z.coerce.number().int().positive(),
    user: z.string().min(1),
    password: z.string().min(1),
    database: z.string().min(1),
    poolSize: z.coerce.number().int().positive(),
    ssl: z.coerce.boolean(),
});

export type DatabaseConfig = z.infer<typeof databaseSchema>;
