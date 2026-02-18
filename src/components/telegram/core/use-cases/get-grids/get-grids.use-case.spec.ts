import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetGridsUseCase } from './get-grids.use-case';
import { PostgresGridRepository } from '../../../secondary/repository/grid/postgres-grid.repository';
import { Grid } from '@domain/grid/grid';
import { GridMode } from '@domain/grid/grid-mode';
import { GridStatus } from '@domain/grid/grid-status';
import { TradingSymbol } from '@domain/primitives/trading-symbol';
import { Price } from '@domain/primitives/price';
import { Decimal } from '@domain/primitives/decimal';

function makeGrid(status: GridStatus = GridStatus.Running): Grid {
    return Grid.create({
        symbol: TradingSymbol.create('BTC'),
        mode: GridMode.Neutral,
        status,
        lowerPrice: Price.from(90000),
        upperPrice: Price.from(100000),
        levels: 10,
        investmentUSDC: Decimal.from(100),
        investmentBase: Decimal.from(0.001),
    });
}

describe('GetGridsUseCase', () => {
    let useCase: GetGridsUseCase;
    let repository: PostgresGridRepository;

    beforeEach(() => {
        repository = {
            findAll: vi.fn(),
            findManyByStatus: vi.fn(),
            findOneById: vi.fn(),
        } as unknown as PostgresGridRepository;

        useCase = new GetGridsUseCase(repository);
    });

    it('calls findAll when filter is "all"', async () => {
        const grids = [makeGrid()];
        vi.mocked(repository.findAll).mockResolvedValue(grids);

        const result = await useCase.execute('all');

        expect(repository.findAll).toHaveBeenCalled();
        expect(result).toBe(grids);
    });

    it('calls findManyByStatus with Running when filter is "running"', async () => {
        const grids = [makeGrid(GridStatus.Running)];
        vi.mocked(repository.findManyByStatus).mockResolvedValue(grids);

        const result = await useCase.execute('running');

        expect(repository.findManyByStatus).toHaveBeenCalledWith(GridStatus.Running);
        expect(result).toBe(grids);
    });

    it('calls findManyByStatus with Stopped when filter is "stopped"', async () => {
        const grids = [makeGrid(GridStatus.Stopped)];
        vi.mocked(repository.findManyByStatus).mockResolvedValue(grids);

        const result = await useCase.execute('stopped');

        expect(repository.findManyByStatus).toHaveBeenCalledWith(GridStatus.Stopped);
        expect(result).toBe(grids);
    });

    it('defaults to "all" when no filter provided', async () => {
        vi.mocked(repository.findAll).mockResolvedValue([]);

        await useCase.execute();

        expect(repository.findAll).toHaveBeenCalled();
    });
});
