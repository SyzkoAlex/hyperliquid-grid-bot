import { Module } from '@nestjs/common';
import { PostgresOrderRepository } from './postgres-order.repository';

@Module({
    providers: [PostgresOrderRepository],
    exports: [PostgresOrderRepository],
})
export class PostgresOrderRepositoryModule {}
