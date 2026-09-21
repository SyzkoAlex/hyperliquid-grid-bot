import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GetMyGridsUseCase } from './get-my-grids.use-case';
import { GridsApiPort } from '@components/grids/api/grids-api.port';
import { TradingApiPort } from '@components/trading/api/trading-api.port';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { GridStatus } from '@domain/models/grid/grid-status';

const USER_ID = 'user-1';

function makeGrid(id: string, symbol: string): GridDto {
    return {
        id,
        userId: USER_ID,
        symbol,
        status: GridStatus.Running,
        lowerPrice: 90,
        upperPrice: 110,
        orderCount: 10,
        investmentUSDC: 500,
        investmentBase: 0,
        trailingEnabled: false,
        trailingTriggerPercent: 5,
        trailingStepPercent: 2,
        trailingPartialClosePercent: 50,
        stopLossEnabled: false,
    };
}

describe('GetMyGridsUseCase', () => {
    let gridsApi: {
        findGridsPagedForUser: ReturnType<typeof vi.fn>;
        buildGridSnapshots: ReturnType<typeof vi.fn>;
    };
    let tradingApi: { getCurrentPrices: ReturnType<typeof vi.fn> };
    let useCase: GetMyGridsUseCase;

    beforeEach(() => {
        gridsApi = {
            findGridsPagedForUser: vi
                .fn()
                .mockResolvedValue({ items: [], totalCount: 0, currentPage: 1 }),
            buildGridSnapshots: vi.fn(async (grids: GridDto[]) => grids.map((grid) => ({ grid }))),
        };
        tradingApi = { getCurrentPrices: vi.fn().mockResolvedValue([]) };
        useCase = new GetMyGridsUseCase(
            gridsApi as unknown as GridsApiPort,
            tradingApi as unknown as TradingApiPort,
        );
    });

    it('passes userId, status and paging to the scoped grids query', async () => {
        await useCase.execute(USER_ID, GridStatus.Stopped, 2, 10);

        expect(gridsApi.findGridsPagedForUser).toHaveBeenCalledWith({
            userId: USER_ID,
            status: GridStatus.Stopped,
            page: 2,
            pageSize: 10,
        });
    });

    it('builds snapshots for the page grids with prices fetched by their symbols', async () => {
        const btc = makeGrid('grid-1', 'BTC');
        const eth = makeGrid('grid-2', 'ETH');
        gridsApi.findGridsPagedForUser.mockResolvedValue({
            items: [btc, eth],
            totalCount: 7,
            currentPage: 1,
        });
        tradingApi.getCurrentPrices.mockResolvedValue([100, 3]);

        const result = await useCase.execute(USER_ID, undefined, 1, 20);

        expect(tradingApi.getCurrentPrices).toHaveBeenCalledWith(['BTC', 'ETH']);
        expect(gridsApi.buildGridSnapshots).toHaveBeenCalledWith([btc, eth], [100, 3]);
        expect(result).toEqual({
            items: [{ grid: btc }, { grid: eth }],
            totalCount: 7,
            currentPage: 1,
        });
    });
});
