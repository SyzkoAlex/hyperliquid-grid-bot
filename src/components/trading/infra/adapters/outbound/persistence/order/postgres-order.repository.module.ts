import { Module } from '@nestjs/common';
import { PostgresOrderRepositoryAdapter } from './postgres-order-repository.adapter';

@Module({
    providers: [PostgresOrderRepositoryAdapter],
    exports: [PostgresOrderRepositoryAdapter],
})
export class PostgresOrderRepositoryModule {}
