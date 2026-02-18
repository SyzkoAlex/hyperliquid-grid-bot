import { Injectable, Inject } from '@nestjs/common';
import type { DrizzleDb } from '@infra/database/drizzle-db';
import { DRIZZLE_DB } from '@infra/database/database.module';
import { Grid } from '@domain/models/grid/grid';
import { GridId } from '@domain/models/grid/grid-id';
import { grids } from '@infra/database/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@infra/logger/logger';
import { PostgresGridMapper } from '@components/shared/infra/adapters/outbound/mappers/postgres-grid.mapper';
import { TelegramGridRepositoryPort } from '@components/telegram/domain/ports/outbound/grid-repository.port';
import { GridStatus } from '@domain/models/grid/grid-status';

@Injectable()
export class PostgresGridRepositoryAdapter implements TelegramGridRepositoryPort {
    private readonly logger = logger.child({ context: PostgresGridRepositoryAdapter.name });

    constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb) {}

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

    async findManyByStatus(status: GridStatus): Promise<Grid[]> {
        try {
            const result = await this.db.select().from(grids).where(eq(grids.status, status));

            return result.map((row) => PostgresGridMapper.toDomain(row));
        } catch (error) {
            this.logger.error({ error, status }, 'Failed to find grids by status');
            return [];
        }
    }

    async findAll(): Promise<Grid[]> {
        try {
            const result = await this.db.select().from(grids);

            return result.map((row) => PostgresGridMapper.toDomain(row));
        } catch (error) {
            this.logger.error({ error }, 'Failed to find all grids');
            return [];
        }
    }
}
