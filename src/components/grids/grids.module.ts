import { Module } from '@nestjs/common';
import { DatabaseModule } from '@adapters/outbound/database/database.module';
import { PostgresGridRepositoryAdapter } from './adapters/outbound/persistence/grid/postgres-grid-repository.adapter';
import { PostgresOrderRepositoryAdapter } from './adapters/outbound/persistence/order/postgres-order-repository.adapter';
import { GridsService } from './core/application/services/grids.service';
import { GRIDS_PORT } from './core/application/ports/grids.port';

@Module({
    imports: [DatabaseModule],
    providers: [
        PostgresGridRepositoryAdapter,
        PostgresOrderRepositoryAdapter,
        { provide: GRIDS_PORT, useClass: GridsService },
    ],
    exports: [GRIDS_PORT],
})
export class GridsModule {}
