import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GetGridWithPnlUseCase } from './get-grid-with-pnl.use-case';
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

describe('GetGridWithPnlUseCase', () => {
    let grids: {
        findGridByIdForUser: ReturnType<typeof vi.fn>;
        findOrdersByGridId: ReturnType<typeof vi.fn>;
        buildGridSnapshot: ReturnType<typeof vi.fn>;
    };
    let tradingApi: { getCurrentPrice: ReturnType<typeof vi.fn> };
    let useCase: GetGridWithPnlUseCase;

    beforeEach(() => {
        grids = {
            findGridByIdForUser: vi.fn().mockResolvedValue(makeGrid()),
            findOrdersByGridId: vi.fn().mockResolvedValue([]),
            buildGridSnapshot: vi.fn().mockReturnValue({ currentPrice: 95000 }),
        };
        tradingApi = { getCurrentPrice: vi.fn().mockResolvedValue(95000) };

        useCase = new GetGridWithPnlUseCase(grids as any, tradingApi as any);
    });

    it('returns null for a missing or foreign grid without fetching orders, price or building a snapshot', async () => {
        grids.findGridByIdForUser.mockResolvedValue(null);

        const result = await useCase.execute('user-2', GRID_ID);

        expect(result).toBeNull();
        expect(grids.findGridByIdForUser).toHaveBeenCalledWith('user-2', GRID_ID);
        expect(grids.findOrdersByGridId).not.toHaveBeenCalled();
        expect(tradingApi.getCurrentPrice).not.toHaveBeenCalled();
        expect(grids.buildGridSnapshot).not.toHaveBeenCalled();
    });

    it('builds the snapshot from the owned grid, its orders and the current price', async () => {
        const grid = makeGrid();
        grids.findGridByIdForUser.mockResolvedValue(grid);

        const result = await useCase.execute(USER_ID, GRID_ID);

        expect(grids.findGridByIdForUser).toHaveBeenCalledWith(USER_ID, GRID_ID);
        expect(tradingApi.getCurrentPrice).toHaveBeenCalledWith('BTC');
        expect(grids.buildGridSnapshot).toHaveBeenCalledWith(grid, [], 95000);
        expect(result).toEqual({ currentPrice: 95000 });
    });
});
