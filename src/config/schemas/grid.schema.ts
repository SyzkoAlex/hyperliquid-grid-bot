import { z } from 'zod';

export const gridTrailingSchema = z.object({
    defaultEnabled: z.coerce.boolean(),
    triggerPercent: z.coerce.number(),
    stepPercent: z.coerce.number(),
    partialClosePercent: z.coerce.number(),
    cooldownMinutes: z.coerce.number().int().positive(),
});

export const gridSchema = z.object({
    defaultLevels: z.coerce.number().int().positive(),
    minLevels: z.coerce.number().int().positive(),
    maxLevels: z.coerce.number().int().positive(),
    defaultMode: z.enum(['neutral', 'long']),
    monitoringInterval: z.coerce.number().int().positive(),
    trailing: gridTrailingSchema,
});

export type GridConfig = z.infer<typeof gridSchema>;
