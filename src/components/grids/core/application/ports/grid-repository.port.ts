import { Grid } from '../../domain/models/grid/grid';
import { GridId } from '../../domain/models/grid/grid-id';
import { GridStatus } from '@domain/models/grid/grid-status';

export const GRID_REPOSITORY_PORT = Symbol('GRID_REPOSITORY_PORT');

export interface GridRepositoryPort {
    save(grid: Grid): Promise<void>;
    findOneById(id: GridId): Promise<Grid | null>;
    findManyActive(): Promise<Grid[]>;
    findManyActiveByIds(gridIds: string[]): Promise<Grid[]>;
    findManyByStatus(status: GridStatus): Promise<Grid[]>;
    findAll(): Promise<Grid[]>;
}
