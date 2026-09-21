import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GetMyGridUseCase } from './get-my-grid.use-case';
import { GridsApiPort } from '@components/grids/api/grids-api.port';
import { TradingApiPort } from '@components/trading/api/trading-api.port';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { GridStatus } from '@domain/models/grid/grid-status';

const USER_ID = 'user-1';
const GRID_ID = '550e8400-e29b-41d4-a716-446655440000';

function makeGrid(): GridDto {
    return {
        id: GRID_ID,
        userId: USER_ID,
        symbol: 'BTC',
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

describe('GetMyGridUseCase', () => {
    let gridsApi: {
        findGridByIdForUser: ReturnType<typeof vi.fn>;
        findOrdersByGridId: ReturnType<typeof vi.fn>;
        buildGridSnapshot: ReturnType<typeof vi.fn>;
    };
    let tradingApi: { getCurrentPrice: ReturnType<typeof vi.fn> };
    let useCase: GetMyGridUseCase;

    beforeEach(() => {
        gridsApi = {
            findGridByIdForUser: vi.fn().mockResolvedValue(makeGrid()),
            findOrdersByGridId: vi.fn().mockResolvedValue([]),
            buildGridSnapshot: vi.fn().mockReturnValue({ currentPrice: 100 }),
        };
        tradingApi = { getCurrentPrice: vi.fn().mockResolvedValue(100) };
        useCase = new GetMyGridUseCase(
            gridsApi as unknown as GridsApiPort,
            tradingApi as unknown as TradingApiPort,
        );
    });

    it('returns null for a foreign or missing grid without fetching orders or price', async () => {
        gridsApi.findGridByIdForUser.mockResolvedValue(null);

        const result = await useCase.execute('user-2', GRID_ID);

        expect(result).toBeNull();
        expect(gridsApi.findGridByIdForUser).toHaveBeenCalledWith('user-2', GRID_ID);
        expect(gridsApi.findOrdersByGridId).not.toHaveBeenCalled();
        expect(tradingApi.getCurrentPrice).not.toHaveBeenCalled();
    });

    it('builds the snapshot of an owned grid', async () => {
        const grid = makeGrid();
        gridsApi.findGridByIdForUser.mockResolvedValue(grid);

        const result = await useCase.execute(USER_ID, GRID_ID);

        expect(tradingApi.getCurrentPrice).toHaveBeenCalledWith('BTC');
        expect(gridsApi.buildGridSnapshot).toHaveBeenCalledWith(grid, [], 100);
        expect(result).toEqual({ currentPrice: 100 });
    });
});
