import { Module } from '@nestjs/common';
import { PostgresGridRepository } from './postgres-grid.repository';

@Module({
    providers: [PostgresGridRepository],
    exports: [PostgresGridRepository],
})
export class PostgresGridRepositoryModule {}
