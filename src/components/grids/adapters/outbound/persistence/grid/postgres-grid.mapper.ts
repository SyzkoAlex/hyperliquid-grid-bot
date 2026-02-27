import { Grid } from '../../../../core/domain/models/grid/grid';
import { GridId } from '../../../../core/domain/models/grid/grid-id';
import { GridStatus } from '@domain/models/grid/grid-status';
import { GridMode } from '@domain/models/grid/grid-mode';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Price } from '@domain/models/primitives/price';
import { Decimal } from '@domain/models/primitives/decimal';
import { Timestamp } from '@domain/models/primitives/timestamp';
import { GridDbRecord } from '@/infra/database/schema';
import { logger } from '@/infra/logger/logger';

export class PostgresGridMapper {
    private static readonly logger = logger.child({ context: PostgresGridMapper.name });

    /**
     * Convert Grid domain entity to database record
     */
    static toDbRecord(grid: Grid): Omit<GridDbRecord, 'updatedAt'> {
        return {
            id: grid.id.toString(),
            symbol: grid.symbol.toString(),
            mode: grid.mode,
            status: grid.status,
            lowerPrice: grid.lowerPrice.toNumber().toString(),
            upperPrice: grid.upperPrice.toNumber().toString(),
            levels: grid.levels,
            investmentUSDC: grid.investmentUSDC.toString(),
            investmentBase: grid.investmentBase.toString(),
            trailingEnabled: grid.trailingEnabled,
            trailingTriggerPercent: grid.trailingTriggerPercent.toString(),
            trailingStepPercent: grid.trailingStepPercent.toString(),
            trailingPartialClosePercent: grid.trailingPartialClosePercent.toString(),
            trailingCount: grid.trailingCount,
            lastTrailingAt: grid.lastTrailingAt?.toDate() ?? null,
            createdAt: grid.createdAt.toDate(),
            startedAt: grid.startedAt?.toDate() ?? null,
            stoppedAt: grid.stoppedAt?.toDate() ?? null,
        };
    }

    /**
     * Convert database row to Grid domain entity
     */
    static toDomain(row: any): Grid {
        try {
            const params = {
                id: GridId.from(row.id),
                symbol: TradingSymbol.create(row.symbol),
                mode: row.mode as GridMode,
                status: row.status as GridStatus,
                lowerPrice: Price.from(parseFloat(row.lowerPrice)),
                upperPrice: Price.from(parseFloat(row.upperPrice)),
                levels: row.levels,
                investmentUSDC: Decimal.from(row.investmentUSDC),
                investmentBase: Decimal.from(row.investmentBase),
                trailingEnabled: row.trailingEnabled,
                trailingTriggerPercent: parseFloat(row.trailingTriggerPercent),
                trailingStepPercent: parseFloat(row.trailingStepPercent),
                trailingPartialClosePercent: parseFloat(row.trailingPartialClosePercent),
                trailingCount: row.trailingCount,
                createdAt: row.createdAt ? Timestamp.from(row.createdAt) : undefined,
                startedAt: row.startedAt ? Timestamp.from(row.startedAt) : undefined,
                stoppedAt: row.stoppedAt ? Timestamp.from(row.stoppedAt) : undefined,
                lastTrailingAt: row.lastTrailingAt ? Timestamp.from(row.lastTrailingAt) : undefined,
            };

            return Grid.create(params);
        } catch (error) {
            this.logger.error(
                {
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                    row,
                },
                'Failed to map row to domain',
            );
            throw error;
        }
    }
}
