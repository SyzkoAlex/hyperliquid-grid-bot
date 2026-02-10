import { Grid } from '@domain/grid/grid';
import { GridId } from '@domain/grid/grid-id';
import { GridStatus } from '@domain/grid/grid-status';
import { GridMode } from '@domain/grid/grid-mode';
import { TradingSymbol } from '@domain/primitives/trading-symbol';
import { Price } from '@domain/primitives/price';
import { Decimal } from '@domain/primitives/decimal';
import { Timestamp } from '@domain/primitives/timestamp';
import { GridDbRecord } from '@infra/database/schema';
import { logger } from '@infra/logger/logger';

export class PostgresGridMapper {
    private static readonly logger = logger.child({ context: PostgresGridMapper.name });

    /**
     * Convert Grid domain entity to database record
     */
    static toDbRecord(grid: Grid): Omit<GridDbRecord, 'createdAt' | 'updatedAt'> {
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
