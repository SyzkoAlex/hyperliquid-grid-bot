import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresGridRepositoryAdapter } from './postgres-grid-repository.adapter';
import { DatabaseTestHelper } from '@infra/database/database-test-helper';
import { grids } from '@infra/database/schema';
import { GridStatus } from '@domain/models/grid/grid-status';
import { GridMode } from '@domain/models/grid/grid-mode';

describe('PostgresGridRepositoryAdapter (telegram, Integration)', () => {
    let repository: PostgresGridRepositoryAdapter;

    const runningGridId = '00000000-0000-0000-0000-000000000001';
    const stoppedGridId = '00000000-0000-0000-0000-000000000002';

    const baseGrid = {
        symbol: 'BTC',
        mode: GridMode.Neutral,
        lowerPrice: '90000',
        upperPrice: '100000',
        levels: 10,
        investmentUSDC: '100',
        investmentBase: '0.001',
        trailingEnabled: false,
        trailingTriggerPercent: '5',
        trailingStepPercent: '10',
        trailingPartialClosePercent: '50',
        trailingCount: 0,
    };

    beforeAll(async () => {
        const db = await DatabaseTestHelper.initialize();
        repository = new PostgresGridRepositoryAdapter(db);

        await db.insert(grids).values([
            { ...baseGrid, id: runningGridId, status: GridStatus.Running },
            { ...baseGrid, id: stoppedGridId, status: GridStatus.Stopped },
        ]);
    });

    afterAll(async () => {
        await DatabaseTestHelper.cleanup();
        await DatabaseTestHelper.close();
    });

    describe('findAll', () => {
        it('returns all grids', async () => {
            const result = await repository.findAll();

            expect(result.length).toBeGreaterThanOrEqual(2);
            const ids = result.map((g) => g.id.toString());
            expect(ids).toContain(runningGridId);
            expect(ids).toContain(stoppedGridId);
        });
    });

    describe('findManyByStatus', () => {
        it('returns only running grids', async () => {
            const result = await repository.findManyByStatus(GridStatus.Running);

            expect(result.every((g) => g.status === GridStatus.Running)).toBe(true);
            expect(result.some((g) => g.id.toString() === runningGridId)).toBe(true);
        });

        it('returns only stopped grids', async () => {
            const result = await repository.findManyByStatus(GridStatus.Stopped);

            expect(result.every((g) => g.status === GridStatus.Stopped)).toBe(true);
            expect(result.some((g) => g.id.toString() === stoppedGridId)).toBe(true);
        });
    });
});
