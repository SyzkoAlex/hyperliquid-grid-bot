import { Injectable } from '@nestjs/common';
import { Grid } from '@domain/grid/grid';
import { GridStatus } from '@domain/grid/grid-status';
import { PostgresGridRepository } from '../../../secondary/repository/grid/postgres-grid.repository';
import { GridFilter } from './types/grid-filter';

@Injectable()
export class GetGridsUseCase {
    constructor(private readonly gridRepository: PostgresGridRepository) {}

    async execute(filter: GridFilter = 'all'): Promise<Grid[]> {
        if (filter === 'running') {
            return this.gridRepository.findManyByStatus(GridStatus.Running);
        }
        if (filter === 'stopped') {
            return this.gridRepository.findManyByStatus(GridStatus.Stopped);
        }
        return this.gridRepository.findAll();
    }
}
