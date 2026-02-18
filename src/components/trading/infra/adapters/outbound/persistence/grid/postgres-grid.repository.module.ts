import { Module } from '@nestjs/common';
import { PostgresGridRepositoryAdapter } from './postgres-grid-repository.adapter';

@Module({
    providers: [PostgresGridRepositoryAdapter],
    exports: [PostgresGridRepositoryAdapter],
})
export class PostgresGridRepositoryModule {}
