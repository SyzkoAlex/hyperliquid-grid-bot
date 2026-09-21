import { z } from 'zod';
import { coerceBoolean } from './coerce-boolean';

export const webApiSchema = z
    .object({
        enabled: coerceBoolean(),
        // Ed25519 SPKI PEM; literal "\n" escapes allowed; empty when disabled
        jwtPublicKey: z.string(),
        jwtAudience: z.string(),
        jwtIssuer: z.string(),
    })
    .refine(
        (c) => !c.enabled || (c.jwtPublicKey !== '' && c.jwtAudience !== '' && c.jwtIssuer !== ''),
        {
            message:
                'webApi.jwtPublicKey, jwtAudience and jwtIssuer are required when webApi.enabled',
        },
    );

export type WebApiConfig = z.infer<typeof webApiSchema>;
