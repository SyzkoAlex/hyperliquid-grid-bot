import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetGridsUseCase } from './get-grids.use-case';
import { TelegramGridRepositoryPort } from '@components/telegram/domain/ports/outbound/grid-repository.port';
import { Grid } from '@domain/models/grid/grid';
import { GridMode } from '@domain/models/grid/grid-mode';
import { GridStatus } from '@domain/models/grid/grid-status';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Price } from '@domain/models/primitives/price';
import { Decimal } from '@domain/models/primitives/decimal';

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
    let repository: TelegramGridRepositoryPort;

    beforeEach(() => {
        repository = {
            findAll: vi.fn(),
            findManyByStatus: vi.fn(),
            findOneById: vi.fn(),
        } as unknown as TelegramGridRepositoryPort;

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
