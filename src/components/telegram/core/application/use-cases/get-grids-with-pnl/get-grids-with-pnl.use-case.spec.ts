import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GetGridsWithPnlUseCase } from './get-grids-with-pnl.use-case';
import { GridFilter } from './grid-filter';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { GridStatus } from '@domain/models/grid/grid-status';

const USER_ID = 'user-1';
const PAGE = 1;
const PAGE_SIZE = 5;

function makeGrid(status = GridStatus.Running): GridDto {
    return {
        id: '550e8400-e29b-41d4-a716-446655440000',
        userId: 'user-1',
        symbol: 'BTC',
        status,
        lowerPrice: 90000,
        upperPrice: 100000,
        orderCount: 10,
        investmentUSDC: 500,
        investmentBase: 0.001,
        trailingEnabled: false,
        trailingTriggerPercent: 5,
        trailingStepPercent: 2,
        trailingPartialClosePercent: 50,
        stopLossEnabled: false,
    };
}

describe('GetGridsWithPnlUseCase', () => {
    let grids: {
        findGridsPagedForUser: ReturnType<typeof vi.fn>;
        buildGridSnapshots: ReturnType<typeof vi.fn>;
    };
    let tradingApi: {
        getCurrentPrices: ReturnType<typeof vi.fn>;
        getUserSpotState: ReturnType<typeof vi.fn>;
        pairExists: ReturnType<typeof vi.fn>;
    };
    let useCase: GetGridsWithPnlUseCase;

    beforeEach(() => {
        grids = {
            findGridsPagedForUser: vi
                .fn()
                .mockResolvedValue({ items: [], totalCount: 0, currentPage: 1 }),
            buildGridSnapshots: vi.fn(async (gridList: GridDto[], prices: number[]) =>
                gridList.map((grid, i) => ({ grid, currentPrice: prices[i] })),
            ),
        };
        tradingApi = {
            getCurrentPrices: vi.fn().mockResolvedValue([95000]),
            getUserSpotState: vi.fn(),
            pairExists: vi.fn(),
        };
        useCase = new GetGridsWithPnlUseCase(grids as any, tradingApi as any);
    });

    it('fetches running grids when filter is Running', async () => {
        await useCase.execute(USER_ID, GridFilter.Running, PAGE, PAGE_SIZE);

        expect(grids.findGridsPagedForUser).toHaveBeenCalledWith({
            userId: USER_ID,
            status: GridStatus.Running,
            page: PAGE,
            pageSize: PAGE_SIZE,
        });
    });

    it('fetches stopped grids when filter is Stopped', async () => {
        await useCase.execute(USER_ID, GridFilter.Stopped, PAGE, PAGE_SIZE);

        expect(grids.findGridsPagedForUser).toHaveBeenCalledWith({
            userId: USER_ID,
            status: GridStatus.Stopped,
            page: PAGE,
            pageSize: PAGE_SIZE,
        });
    });

    it('fetches all grids when filter is All', async () => {
        await useCase.execute(USER_ID, GridFilter.All, PAGE, PAGE_SIZE);

        expect(grids.findGridsPagedForUser).toHaveBeenCalledWith({
            userId: USER_ID,
            status: undefined,
            page: PAGE,
            pageSize: PAGE_SIZE,
        });
    });

    it('returns items, totalCount and currentPage', async () => {
        const grid = makeGrid();
        grids.findGridsPagedForUser.mockResolvedValue({
            items: [grid],
            totalCount: 1,
            currentPage: 1,
        });

        const result = await useCase.execute(USER_ID, GridFilter.Running, PAGE, PAGE_SIZE);

        expect(result.totalCount).toBe(1);
        expect(result.currentPage).toBe(1);
        expect(result.items).toHaveLength(1);
        expect(result.items[0].grid).toBe(grid);
    });

    it('passes page and pageSize to findGridsPagedForUser', async () => {
        await useCase.execute(USER_ID, GridFilter.Running, 2, PAGE_SIZE);

        expect(grids.findGridsPagedForUser).toHaveBeenCalledWith({
            userId: USER_ID,
            status: GridStatus.Running,
            page: 2,
            pageSize: PAGE_SIZE,
        });
    });

    it('returns currentPage from findGridsPagedForUser', async () => {
        grids.findGridsPagedForUser.mockResolvedValue({ items: [], totalCount: 5, currentPage: 1 });

        const result = await useCase.execute(USER_ID, GridFilter.Running, 99, PAGE_SIZE);

        expect(result.currentPage).toBe(1);
    });

    it('includes current price from trading api', async () => {
        const grid = makeGrid();
        grids.findGridsPagedForUser.mockResolvedValue({
            items: [grid],
            totalCount: 1,
            currentPage: 1,
        });
        tradingApi.getCurrentPrices.mockResolvedValue([98000]);

        const result = await useCase.execute(USER_ID, GridFilter.Running, PAGE, PAGE_SIZE);

        expect(result.items[0].currentPrice).toBe(98000);
    });

    it('builds snapshots for the page grids with prices fetched by their symbols', async () => {
        const first = makeGrid();
        const second = { ...makeGrid(), id: 'other-grid', symbol: 'ETH' };
        grids.findGridsPagedForUser.mockResolvedValue({
            items: [first, second],
            totalCount: 2,
            currentPage: 1,
        });
        tradingApi.getCurrentPrices.mockResolvedValue([95000, 3000]);

        await useCase.execute(USER_ID, GridFilter.Running, PAGE, PAGE_SIZE);

        expect(tradingApi.getCurrentPrices).toHaveBeenCalledWith(['BTC', 'ETH']);
        expect(grids.buildGridSnapshots).toHaveBeenCalledWith([first, second], [95000, 3000]);
    });
});
