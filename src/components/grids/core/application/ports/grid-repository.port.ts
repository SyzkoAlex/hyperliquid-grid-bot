import { Grid } from '../../domain/models/grid/grid';
import { GridId } from '../../domain/models/grid/grid-id';
import { GridStatus } from '@domain/models/grid/grid-status';
import { GridWithAccount } from './grid-with-account';

export { GridWithAccount };

export const GRID_REPOSITORY_PORT = Symbol('GRID_REPOSITORY_PORT');

export interface GridRepositoryPort {
    save(grid: Grid): Promise<void>;
    findOneById(id: GridId): Promise<Grid | null>;
    findManyActive(): Promise<Grid[]>;
    findManyActiveByUserId(userId: string): Promise<Grid[]>;
    findManyByStatusPaged(
        status: GridStatus | undefined,
        offset: number,
        limit: number,
    ): Promise<Grid[]>;
    countByStatus(status: GridStatus | undefined): Promise<number>;
    findManyActiveByCursor(afterId: string | null, limit: number): Promise<GridWithAccount[]>;
}
