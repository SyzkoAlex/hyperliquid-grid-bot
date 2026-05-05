import { z } from 'zod';

export const coerceBoolean = () =>
    z.preprocess((v) => (v === 'false' || v === '0' ? false : v), z.coerce.boolean());
