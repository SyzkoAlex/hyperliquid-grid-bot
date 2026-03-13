import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { DrizzleDb } from '@/infra/database/drizzle-db';
import { DatabaseTestHelper } from '@/infra/tests/database-test-helper';
import { Grid } from '../../../../core/domain/models/grid/grid';
import { GridId } from '../../../../core/domain/models/grid/grid-id';
import { GridStatus } from '@domain/models/grid/grid-status';
import { GridMode } from '@domain/models/grid/grid-mode';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Price } from '@domain/models/primitives/price';
import { Decimal } from '@domain/models/primitives/decimal';
import { Timestamp } from '@domain/models/primitives/timestamp';
import { PostgresGridRepositoryAdapter } from './postgres-grid-repository.adapter';

function createGrid(
    overrides: Partial<{
        id: GridId;
        symbol: string;
        mode: GridMode;
        status: GridStatus;
        lowerPrice: number;
        upperPrice: number;
        levels: number;
        investmentUSDC: number;
        investmentBase: number;
        trailingEnabled: boolean;
        startedAt: Timestamp;
        stoppedAt: Timestamp;
    }> = {},
): Grid {
    const mode = overrides.mode ?? GridMode.Neutral;
    return Grid.create({
        id: overrides.id ?? GridId.create(),
        symbol: TradingSymbol.create(overrides.symbol ?? 'HYPE'),
        mode,
        status: overrides.status,
        lowerPrice: Price.from(overrides.lowerPrice ?? 100),
        upperPrice: Price.from(overrides.upperPrice ?? 200),
        levels: overrides.levels ?? 10,
        investmentUSDC: Decimal.from(overrides.investmentUSDC ?? 1000),
        investmentBase: Decimal.from(
            overrides.investmentBase ?? (mode === GridMode.Neutral ? 5 : 0),
        ),
        trailingEnabled: overrides.trailingEnabled ?? false,
        startedAt: overrides.startedAt,
        stoppedAt: overrides.stoppedAt,
    });
}

describe('PostgresGridRepositoryAdapter (Integration)', () => {
    let db: DrizzleDb;
    let repository: PostgresGridRepositoryAdapter;

    beforeAll(async () => {
        db = await DatabaseTestHelper.initialize();
        repository = new PostgresGridRepositoryAdapter(db);
    }, 120_000);

    afterEach(async () => {
        await DatabaseTestHelper.cleanup();
    });

    afterAll(async () => {
        await DatabaseTestHelper.close();
    });

    describe('save', () => {
        it('should insert a new grid', async () => {
            const grid = createGrid();

            await repository.save(grid);

            const found = await repository.findOneById(grid.id);
            expect(found).not.toBeNull();
            expect(found!.id.toString()).toBe(grid.id.toString());
            expect(found!.symbol.toString()).toBe('HYPE');
            expect(found!.mode).toBe(GridMode.Neutral);
            expect(found!.status).toBe(GridStatus.Idle);
            expect(found!.levels).toBe(10);
        });

        it('should upsert an existing grid', async () => {
            const grid = createGrid();
            await repository.save(grid);

            grid.start();
            await repository.save(grid);

            const found = await repository.findOneById(grid.id);
            expect(found!.status).toBe(GridStatus.Running);
        });
    });

    describe('findOneById', () => {
        it('should return null for non-existent grid', async () => {
            const result = await repository.findOneById(GridId.create());
            expect(result).toBeNull();
        });

        it('should preserve all grid fields through round-trip', async () => {
            const grid = createGrid({
                lowerPrice: 50.5,
                upperPrice: 150.75,
                levels: 20,
                investmentUSDC: 5000,
                investmentBase: 10,
                trailingEnabled: true,
            });

            await repository.save(grid);
            const found = await repository.findOneById(grid.id);

            expect(found!.lowerPrice.toNumber()).toBeCloseTo(50.5, 4);
            expect(found!.upperPrice.toNumber()).toBeCloseTo(150.75, 4);
            expect(found!.levels).toBe(20);
            expect(found!.investmentUSDC.toString()).toBe('5000');
            expect(found!.investmentBase.toString()).toBe('10');
            expect(found!.trailingEnabled).toBe(true);
        });
    });

    describe('findManyActive', () => {
        it('should return only running grids', async () => {
            const running = createGrid();
            running.start();
            const idle = createGrid();
            const stopped = createGrid();
            stopped.start();
            stopped.stop();

            await repository.save(running);
            await repository.save(idle);
            await repository.save(stopped);

            const result = await repository.findManyActive();
            expect(result).toHaveLength(1);
            expect(result[0].id.toString()).toBe(running.id.toString());
        });

        it('should return empty array when no active grids', async () => {
            const result = await repository.findManyActive();
            expect(result).toEqual([]);
        });
    });

    describe('findManyByStatusPaged', () => {
        it('should return paginated results', async () => {
            const grids: Grid[] = [];
            for (let i = 0; i < 5; i++) {
                const g = createGrid();
                grids.push(g);
            }
            for (const g of grids) {
                await repository.save(g);
            }

            const page1 = await repository.findManyByStatusPaged(GridStatus.Idle, 0, 2);
            const page2 = await repository.findManyByStatusPaged(GridStatus.Idle, 2, 2);
            const page3 = await repository.findManyByStatusPaged(GridStatus.Idle, 4, 2);

            expect(page1).toHaveLength(2);
            expect(page2).toHaveLength(2);
            expect(page3).toHaveLength(1);
        });

        it('should order stopped grids by stoppedAt descending', async () => {
            const g1 = createGrid();
            g1.start();
            g1.stop();
            await repository.save(g1);

            // small delay so stoppedAt timestamps differ
            await new Promise((r) => setTimeout(r, 50));

            const g2 = createGrid();
            g2.start();
            g2.stop();
            await repository.save(g2);

            const result = await repository.findManyByStatusPaged(GridStatus.Stopped, 0, 10);
            expect(result).toHaveLength(2);
            expect(result[0].id.toString()).toBe(g2.id.toString());
            expect(result[1].id.toString()).toBe(g1.id.toString());
        });
    });

    describe('countByStatus', () => {
        it('should count grids by status', async () => {
            const g1 = createGrid();
            const g2 = createGrid();
            g2.start();
            const g3 = createGrid();

            await repository.save(g1);
            await repository.save(g2);
            await repository.save(g3);

            expect(await repository.countByStatus(GridStatus.Idle)).toBe(2);
            expect(await repository.countByStatus(GridStatus.Running)).toBe(1);
            expect(await repository.countByStatus(GridStatus.Stopped)).toBe(0);
        });
    });
});
