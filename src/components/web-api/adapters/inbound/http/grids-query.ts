import { z } from 'zod';
import { GridStatus } from '@domain/models/grid/grid-status';

const MAX_PAGE_SIZE = 50;

export const gridsQuerySchema = z.object({
    status: z.enum(GridStatus).optional(),
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
});
