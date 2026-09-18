import { z } from 'zod';

export const predictionSchema = z.object({
    // Base URL of the hyperliquid-grid-prediction service (e.g. http://prediction:8080);
    // empty/unset = AI grid mode disabled
    baseUrl: z.string().optional(),
    requestTimeout: z.coerce.number().int().positive(),
});

export type PredictionConfig = z.infer<typeof predictionSchema>;
