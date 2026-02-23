import { Injectable, Inject } from '@nestjs/common';
import type { DrizzleDb } from '@adapters/outbound/database/drizzle-db';
import { DRIZZLE_DB } from '@adapters/outbound/database/database.module';
import { Grid } from '@domain/models/grid/grid';
import { GridId } from '@domain/models/grid/grid-id';
import { GridStatus } from '@domain/models/grid/grid-status';
import { grids } from '@adapters/outbound/database/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { logger } from '@/infra/logger/logger';
import { PostgresGridMapper } from '@adapters/outbound/database/mappers/postgres-grid.mapper';
import { GridRepositoryPort } from '@components/trading/core/application/ports/grid-repository.port';

@Injectable()
export class PostgresGridRepositoryAdapter implements GridRepositoryPort {
    private readonly logger = logger.child({ context: PostgresGridRepositoryAdapter.name });

    constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb) {}

    async save(grid: Grid): Promise<void> {
        try {
            const record = PostgresGridMapper.toDbRecord(grid);
            await this.db.insert(grids).values(record).onConflictDoUpdate({
                target: grids.id,
                set: record,
            });
            this.logger.info({ gridId: grid.id.toString() }, 'Grid saved');
        } catch (error) {
            this.logger.error({ error, gridId: grid.id.toString() }, 'Failed to save grid');
            throw error;
        }
    }

    async findOneById(id: GridId): Promise<Grid | null> {
        try {
            const result = await this.db
                .select()
                .from(grids)
                .where(eq(grids.id, id.toString()))
                .limit(1);

            if (result.length === 0) return null;

            return PostgresGridMapper.toDomain(result[0]);
        } catch (error) {
            this.logger.error({ error, gridId: id.toString() }, 'Failed to find grid');
            return null;
        }
    }

    async findManyActive(): Promise<Grid[]> {
        try {
            const result = await this.db
                .select()
                .from(grids)
                .where(eq(grids.status, GridStatus.Running));

            return result.map((row) => PostgresGridMapper.toDomain(row));
        } catch (error) {
            this.logger.error({ error }, 'Failed to find active grids');
            return [];
        }
    }

    async findManyActiveByIds(gridIds: string[]): Promise<Grid[]> {
        if (gridIds.length === 0) return [];

        try {
            const result = await this.db
                .select()
                .from(grids)
                .where(and(inArray(grids.id, gridIds), eq(grids.status, GridStatus.Running)));

            return result.map((row) => PostgresGridMapper.toDomain(row));
        } catch (error) {
            this.logger.error({ error, gridIds }, 'Failed to find active grids by IDs');
            return [];
        }
    }
}
