import { Grid } from '@domain/models/grid/grid';
import { GridId } from '@domain/models/grid/grid-id';
import { GridStatus } from '@domain/models/grid/grid-status';

export const TELEGRAM_GRID_REPOSITORY_PORT = Symbol('TELEGRAM_GRID_REPOSITORY_PORT');

export interface TelegramGridRepositoryPort {
    findOneById(id: GridId): Promise<Grid | null>;
    findManyByStatus(status: GridStatus): Promise<Grid[]>;
    findAll(): Promise<Grid[]>;
}
