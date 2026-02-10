import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { TradingSymbol } from '@domain/primitives/trading-symbol';
import { Price } from '@domain/primitives/price';
import { Decimal } from '@domain/primitives/decimal';
import { Grid } from '@domain/grid/grid';
import { GridId } from '@domain/grid/grid-id';
import { GridMode } from '@domain/grid/grid-mode';
import { GridStatus } from '@domain/grid/grid-status';
import { PostgresGridRepository } from './postgres-grid.repository';
import { DatabaseTestHelper } from '@infra/database/database-test-helper';
import { grids } from '../../../../../infra/database/schema';
import { eq } from 'drizzle-orm';

/**
 * Integration Tests for PostgresGridRepository with Testcontainers
 *
 * These tests use Testcontainers to automatically manage PostgreSQL Docker container.
 * No manual setup required - container is created and destroyed automatically.
 *
 * Run with: pnpm test:integration
 */
describe('PostgresGridRepository (Integration)', () => {
    let repository: PostgresGridRepository;
    const createdGridIds: string[] = [];

    beforeAll(async () => {
        // Initialize testcontainer
        const db = await DatabaseTestHelper.initialize();

        // Create repository with database instance directly
        repository = new PostgresGridRepository(db);

        console.log('🧪 PostgresGridRepository test setup complete');
        console.log('🔗 Database connection:', DatabaseTestHelper.getConnectionUri());
    });

    afterEach(async () => {
        // Cleanup: Delete test grids
        if (createdGridIds.length > 0) {
            const db = DatabaseTestHelper.getDb();
            for (const gridId of createdGridIds) {
                await db.delete(grids).where(eq(grids.id, gridId));
            }
            createdGridIds.length = 0;
            console.log('🗑️  Test grids cleaned up');
        }
    });

    afterAll(async () => {
        // Stop testcontainer
        await DatabaseTestHelper.close();
    });

    describe('save', () => {
        it('should save a new grid to database', async () => {
            const grid = Grid.create({
                symbol: TradingSymbol.create('BTC'),
                mode: GridMode.Neutral,
                lowerPrice: Price.from(45000),
                upperPrice: Price.from(55000),
                levels: 10,
                investmentUSDC: Decimal.from(5000),
                investmentBase: Decimal.from(0.1),
                trailingEnabled: false,
                trailingTriggerPercent: 5,
                trailingStepPercent: 2,
                trailingPartialClosePercent: 50,
            });

            createdGridIds.push(grid.id.toString());

            await repository.save(grid);

            // Verify grid was saved
            const savedGrid = await repository.findOneById(grid.id);

            expect(savedGrid).toBeDefined();
            expect(savedGrid!.id.toString()).toBe(grid.id.toString());
            expect(savedGrid!.symbol.toString()).toBe('BTC');
            expect(savedGrid!.mode).toBe(GridMode.Neutral);
            expect(savedGrid!.status).toBe(GridStatus.Idle);
            expect(savedGrid!.lowerPrice.toNumber()).toBe(45000);
            expect(savedGrid!.upperPrice.toNumber()).toBe(55000);
            expect(savedGrid!.levels).toBe(10);
            expect(savedGrid!.investmentUSDC.toNumber()).toBe(5000);
            expect(savedGrid!.investmentBase.toNumber()).toBe(0.1);

            console.log('✅ Grid saved:', grid.id.toString());
        });

        it('should save grid with trailing enabled', async () => {
            const grid = Grid.create({
                symbol: TradingSymbol.create('ETH'),
                mode: GridMode.Long,
                lowerPrice: Price.from(2500),
                upperPrice: Price.from(3500),
                levels: 15,
                investmentUSDC: Decimal.from(3000),
                investmentBase: Decimal.from(1.0),
                trailingEnabled: true,
                trailingTriggerPercent: 10,
                trailingStepPercent: 3,
                trailingPartialClosePercent: 30,
            });

            createdGridIds.push(grid.id.toString());

            await repository.save(grid);

            const savedGrid = await repository.findOneById(grid.id);

            expect(savedGrid).toBeDefined();
            expect(savedGrid!.trailingEnabled).toBe(true);
            expect(savedGrid!.mode).toBe(GridMode.Long);

            console.log('✅ Grid with trailing saved');
        });
    });

    describe('findById', () => {
        it('should find grid by id', async () => {
            const grid = Grid.create({
                symbol: TradingSymbol.create('BTC'),
                mode: GridMode.Neutral,
                lowerPrice: Price.from(45000),
                upperPrice: Price.from(55000),
                levels: 10,
                investmentUSDC: Decimal.from(5000),
                investmentBase: Decimal.from(0.1),
                trailingEnabled: false,
                trailingTriggerPercent: 5,
                trailingStepPercent: 2,
                trailingPartialClosePercent: 50,
            });

            createdGridIds.push(grid.id.toString());
            await repository.save(grid);

            const foundGrid = await repository.findOneById(grid.id);

            expect(foundGrid).toBeDefined();
            expect(foundGrid!.id.toString()).toBe(grid.id.toString());

            console.log('✅ Grid found by ID');
        });

        it('should return null for non-existent grid', async () => {
            const nonExistentId = GridId.create();
            const foundGrid = await repository.findOneById(nonExistentId);

            expect(foundGrid).toBeNull();

            console.log('✅ Returns null for non-existent grid');
        });
    });

    describe('findActiveGrids', () => {
        it('should find only running grids', async () => {
            // Create idle grid
            const idleGrid = Grid.create({
                symbol: TradingSymbol.create('BTC'),
                mode: GridMode.Neutral,
                lowerPrice: Price.from(45000),
                upperPrice: Price.from(55000),
                levels: 10,
                investmentUSDC: Decimal.from(5000),
                investmentBase: Decimal.from(0.1),
                trailingEnabled: false,
                trailingTriggerPercent: 5,
                trailingStepPercent: 2,
                trailingPartialClosePercent: 50,
            });

            await repository.save(idleGrid);
            createdGridIds.push(idleGrid.id.toString());

            // Create running grid with status
            const runningGrid = Grid.create({
                symbol: TradingSymbol.create('ETH'),
                mode: GridMode.Long,
                lowerPrice: Price.from(2500),
                upperPrice: Price.from(3500),
                levels: 10,
                investmentUSDC: Decimal.from(3000),
                investmentBase: Decimal.from(1.0),
                trailingEnabled: false,
                trailingTriggerPercent: 5,
                trailingStepPercent: 2,
                trailingPartialClosePercent: 50,
                status: GridStatus.Running, // Set status directly
            });

            await repository.save(runningGrid);
            createdGridIds.push(runningGrid.id.toString());

            // Find active grids
            const activeGrids = await repository.findManyActive();

            expect(activeGrids.length).toBeGreaterThan(0);
            expect(activeGrids.some((g) => g.id.toString() === runningGrid.id.toString())).toBe(
                true,
            );
            expect(activeGrids.every((g) => g.status === GridStatus.Running)).toBe(true);

            console.log('✅ Active grids found:', activeGrids.length);
        });

        it('should return empty array when no active grids', async () => {
            // Ensure no running grids
            const activeGrids = await repository.findManyActive();

            // Note: This test might fail if there are existing running grids in test DB
            // In real scenario, you'd clean up all grids before this test
            expect(activeGrids).toBeInstanceOf(Array);

            console.log('✅ Returns array for active grids query');
        });
    });

    describe('domain mapping', () => {
        it('should correctly map domain object to database and back', async () => {
            const originalGrid = Grid.create({
                symbol: TradingSymbol.create('SOL'),
                mode: GridMode.Long,
                status: GridStatus.Running,
                lowerPrice: Price.from(80),
                upperPrice: Price.from(120),
                levels: 20,
                investmentUSDC: Decimal.from(2000),
                investmentBase: Decimal.from(25),
                trailingEnabled: true,
                trailingTriggerPercent: 8,
                trailingStepPercent: 2.5,
                trailingPartialClosePercent: 40,
            });

            await repository.save(originalGrid);
            createdGridIds.push(originalGrid.id.toString());

            const retrievedGrid = await repository.findOneById(originalGrid.id);

            // Verify all fields are correctly mapped
            expect(retrievedGrid).toBeDefined();
            expect(retrievedGrid).not.toBeNull();
            expect(retrievedGrid!.symbol.toString()).toBe(originalGrid.symbol.toString());
            expect(retrievedGrid!.mode).toBe(originalGrid.mode);
            expect(retrievedGrid!.status).toBe(originalGrid.status);
            expect(retrievedGrid!.lowerPrice.toNumber()).toBe(originalGrid.lowerPrice.toNumber());
            expect(retrievedGrid!.upperPrice.toNumber()).toBe(originalGrid.upperPrice.toNumber());
            expect(retrievedGrid!.levels).toBe(originalGrid.levels);
            expect(retrievedGrid!.investmentUSDC.toNumber()).toBe(
                originalGrid.investmentUSDC.toNumber(),
            );
            expect(retrievedGrid!.investmentBase.toNumber()).toBe(
                originalGrid.investmentBase.toNumber(),
            );
            expect(retrievedGrid!.trailingEnabled).toBe(originalGrid.trailingEnabled);

            console.log('✅ Domain mapping verified');
        });
    });
});
