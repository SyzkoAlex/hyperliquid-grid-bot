import { z } from 'zod';
import { AppTypes } from '../app.types';

export const appSchema = z.object({
    type: z.nativeEnum(AppTypes),
    name: z.string(),
    port: z.coerce.number().int().positive(),
    host: z.string(),
});

export type AppConfig = z.infer<typeof appSchema>;
