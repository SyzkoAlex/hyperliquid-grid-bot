import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infra/database/database.module';
import { PostgresGridRepositoryAdapter } from './adapters/outbound/persistence/grid/postgres-grid-repository.adapter';
import { PostgresOrderRepositoryAdapter } from './adapters/outbound/persistence/order/postgres-order-repository.adapter';
import { GridsApiAdapter } from './api/grids-api.adapter';
import { GRIDS_API_PORT } from './api/grids-api.port';
import { GRID_REPOSITORY_PORT } from './core/application/ports/grid-repository.port';
import { ORDER_REPOSITORY_PORT } from './core/application/ports/order-repository.port';
@Module({
    imports: [DatabaseModule],
    providers: [
        { provide: GRID_REPOSITORY_PORT, useClass: PostgresGridRepositoryAdapter },
        { provide: ORDER_REPOSITORY_PORT, useClass: PostgresOrderRepositoryAdapter },
        { provide: GRIDS_API_PORT, useClass: GridsApiAdapter },
    ],
    exports: [GRIDS_API_PORT],
})
export class GridsModule {}
