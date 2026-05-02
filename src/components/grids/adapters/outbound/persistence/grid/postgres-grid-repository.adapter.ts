import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDb } from '@/infra/database/drizzle-db';
import { DRIZZLE_DB } from '@/infra/database/database.module';
import { Grid } from '../../../../core/domain/models/grid/grid';
import { GridId } from '../../../../core/domain/models/grid/grid-id';
import { GridStatus } from '@domain/models/grid/grid-status';
import { grids, users } from '@/infra/database/schema';
import { and, asc, count, desc, eq, gt } from 'drizzle-orm';
import { logger } from '@/infra/logger/logger';
import {
    GridRepositoryPort,
    GridWithAccount,
} from '../../../../core/application/ports/grid-repository.port';
import { PostgresGridMapper } from './postgres-grid.mapper';

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

    async findManyActiveByUserId(userId: string): Promise<Grid[]> {
        try {
            const result = await this.db
                .select()
                .from(grids)
                .where(and(eq(grids.status, GridStatus.Running), eq(grids.userId, userId)));
            return result.map((row) => PostgresGridMapper.toDomain(row));
        } catch (error) {
            this.logger.error({ error, userId }, 'Failed to find active grids by userId');
            return [];
        }
    }

    async findManyByStatusPaged(
        status: GridStatus | undefined,
        offset: number,
        limit: number,
    ): Promise<Grid[]> {
        try {
            const orderExpr =
                status === GridStatus.Stopped ? desc(grids.stoppedAt) : asc(grids.createdAt);
            const result = await this.db
                .select()
                .from(grids)
                .where(status !== undefined ? eq(grids.status, status) : undefined)
                .orderBy(orderExpr)
                .limit(limit)
                .offset(offset);
            return result.map((row) => PostgresGridMapper.toDomain(row));
        } catch (error) {
            this.logger.error(
                { error, status, offset, limit },
                'Failed to find paged grids by status',
            );
            return [];
        }
    }

    async countByStatus(status: GridStatus | undefined): Promise<number> {
        try {
            const result = await this.db
                .select({ count: count() })
                .from(grids)
                .where(status !== undefined ? eq(grids.status, status) : undefined);
            return result[0].count;
        } catch (error) {
            this.logger.error({ error, status }, 'Failed to count grids by status');
            return 0;
        }
    }

    async findManyActiveByCursor(
        afterId: string | null,
        limit: number,
    ): Promise<GridWithAccount[]> {
        try {
            const whereClause = afterId
                ? and(eq(grids.status, GridStatus.Running), gt(grids.id, afterId))
                : eq(grids.status, GridStatus.Running);

            const result = await this.db
                .select({
                    grid: grids,
                    accountAddress: users.accountAddress,
                })
                .from(grids)
                .innerJoin(users, eq(grids.userId, users.id))
                .where(whereClause)
                .orderBy(asc(grids.id))
                .limit(limit);

            return result.map(({ grid, accountAddress }) => ({
                grid: PostgresGridMapper.toDomain(grid),
                accountAddress,
            }));
        } catch (error) {
            this.logger.error({ error, afterId, limit }, 'Failed to find active grids by cursor');
            return [];
        }
    }
}
