import { Injectable, Inject } from '@nestjs/common';
import { Grid } from '@domain/models/grid/grid';
import { GridStatus } from '@domain/models/grid/grid-status';
import {
    TELEGRAM_GRID_REPOSITORY_PORT,
    TelegramGridRepositoryPort,
} from '@components/telegram/domain/ports/outbound/grid-repository.port';
import { GridFilter } from './types/grid-filter';

@Injectable()
export class GetGridsUseCase {
    constructor(
        @Inject(TELEGRAM_GRID_REPOSITORY_PORT)
        private readonly gridRepository: TelegramGridRepositoryPort,
    ) {}

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
