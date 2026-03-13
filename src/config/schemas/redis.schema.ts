import { z } from 'zod';

export const redisSchema = z.object({
    url: z.string().min(1),
    db: z.coerce.number().int().min(0),
    connectTimeout: z.coerce.number().int().positive(),
});

export type RedisConfig = z.infer<typeof redisSchema>;
