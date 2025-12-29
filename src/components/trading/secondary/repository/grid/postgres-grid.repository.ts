import { Injectable, Inject } from '@nestjs/common';
import type { DrizzleDb } from '../../../../../infra/database/drizzle-db';
import { DRIZZLE_DB } from '../../../../../infra/database/database.module';
import { Grid } from '../../../core/domain/grid/grid';
import { GridId } from '../../../core/domain/grid/grid-id';
import { GridStatus } from '../../../core/domain/grid/grid-status';
import { grids } from '../../../../../infra/database/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../../../../../infra/logger/logger';
import { PostgresGridMapper } from './postgres-grid.mapper';

/**
 * Postgres Grid Repository
 * Secondary Adapter for Grid persistence
 */
@Injectable()
export class PostgresGridRepository {
    private readonly logger = logger.child({ context: PostgresGridRepository.name });

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
}
