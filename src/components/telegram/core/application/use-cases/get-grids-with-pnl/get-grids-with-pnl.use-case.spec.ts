import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GetGridsWithPnlUseCase } from './get-grids-with-pnl.use-case';
import { GridFilter } from './grid-filter';
import { GridSnapshotFactory } from '../../services/grid-snapshot-factory/grid-snapshot.factory';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { OrderDto } from '@components/grids/api/dto/order.dto';
import { GridStatus } from '@domain/models/grid/grid-status';
import { OrderSide } from '@domain/models/order/order-side';
import { OrderStatus } from '@domain/models/order/order-status';
import { OrderType } from '@domain/models/order/order-type';

const PAGE = 1;
const PAGE_SIZE = 5;

function makeGrid(status = GridStatus.Running): GridDto {
    return {
        id: '550e8400-e29b-41d4-a716-446655440000',
        symbol: 'BTC',
        status,
        lowerPrice: 90000,
        upperPrice: 100000,
        levels: 10,
        investmentUSDC: 500,
        investmentBase: 0.001,
        trailingEnabled: false,
        trailingTriggerPercent: 5,
        trailingStepPercent: 2,
        trailingPartialClosePercent: 50,
    };
}

function makeOrder(side: OrderSide, status: OrderStatus, price = 95000, amount = 0.001): OrderDto {
    return {
        id: '660e8400-e29b-41d4-a716-446655440001',
        gridId: '550e8400-e29b-41d4-a716-446655440000',
        symbol: 'BTC',
        side,
        status,
        type: OrderType.Limit,
        levelIndex: 5,
        price,
        amount,
        exchangeOrderId: null,
        createdAt: Date.now(),
    };
}

describe('GetGridsWithPnlUseCase', () => {
    let grids: {
        findGridsPaged: ReturnType<typeof vi.fn>;
        findOrdersByGridIds: ReturnType<typeof vi.fn>;
    };
    let tradingApi: {
        getCurrentPrices: ReturnType<typeof vi.fn>;
        getUserSpotState: ReturnType<typeof vi.fn>;
        pairExists: ReturnType<typeof vi.fn>;
    };
    let snapshotFactory: GridSnapshotFactory;
    let useCase: GetGridsWithPnlUseCase;

    beforeEach(() => {
        grids = {
            findGridsPaged: vi.fn().mockResolvedValue({ items: [], totalCount: 0, currentPage: 1 }),
            findOrdersByGridIds: vi.fn().mockResolvedValue([]),
        };
        tradingApi = {
            getCurrentPrices: vi.fn().mockResolvedValue([95000]),
            getUserSpotState: vi.fn(),
            pairExists: vi.fn(),
        };
        const pnlCalculator = {
            calculate: vi.fn().mockReturnValue({ gridProfit: 0, unrealizedPnl: 0, totalFees: 0 }),
        };
        snapshotFactory = new GridSnapshotFactory(pnlCalculator as any);

        useCase = new GetGridsWithPnlUseCase(grids as any, tradingApi as any, snapshotFactory);
    });

    it('fetches running grids when filter is Running', async () => {
        await useCase.execute(GridFilter.Running, PAGE, PAGE_SIZE);

        expect(grids.findGridsPaged).toHaveBeenCalledWith({
            status: GridStatus.Running,
            page: PAGE,
            pageSize: PAGE_SIZE,
        });
    });

    it('fetches stopped grids when filter is Stopped', async () => {
        await useCase.execute(GridFilter.Stopped, PAGE, PAGE_SIZE);

        expect(grids.findGridsPaged).toHaveBeenCalledWith({
            status: GridStatus.Stopped,
            page: PAGE,
            pageSize: PAGE_SIZE,
        });
    });

    it('fetches all grids when filter is All', async () => {
        await useCase.execute(GridFilter.All, PAGE, PAGE_SIZE);

        expect(grids.findGridsPaged).toHaveBeenCalledWith({
            status: undefined,
            page: PAGE,
            pageSize: PAGE_SIZE,
        });
    });

    it('returns items, totalCount and currentPage', async () => {
        const grid = makeGrid();
        grids.findGridsPaged.mockResolvedValue({ items: [grid], totalCount: 1, currentPage: 1 });

        const result = await useCase.execute(GridFilter.Running, PAGE, PAGE_SIZE);

        expect(result.totalCount).toBe(1);
        expect(result.currentPage).toBe(1);
        expect(result.items).toHaveLength(1);
        expect(result.items[0].grid).toBe(grid);
    });

    it('passes page and pageSize to findGridsPaged', async () => {
        await useCase.execute(GridFilter.Running, 2, PAGE_SIZE);

        expect(grids.findGridsPaged).toHaveBeenCalledWith({
            status: GridStatus.Running,
            page: 2,
            pageSize: PAGE_SIZE,
        });
    });

    it('returns currentPage from findGridsPaged', async () => {
        grids.findGridsPaged.mockResolvedValue({ items: [], totalCount: 5, currentPage: 1 });

        const result = await useCase.execute(GridFilter.Running, 99, PAGE_SIZE);

        expect(result.currentPage).toBe(1);
    });

    it('includes current price from trading api', async () => {
        const grid = makeGrid();
        grids.findGridsPaged.mockResolvedValue({ items: [grid], totalCount: 1, currentPage: 1 });
        tradingApi.getCurrentPrices.mockResolvedValue([98000]);

        const result = await useCase.execute(GridFilter.Running, PAGE, PAGE_SIZE);

        expect(result.items[0].currentPrice).toBe(98000);
    });

    it('counts filled sell orders as filledCycles', async () => {
        const grid = makeGrid();
        grids.findGridsPaged.mockResolvedValue({ items: [grid], totalCount: 1, currentPage: 1 });
        grids.findOrdersByGridIds.mockResolvedValue([
            makeOrder(OrderSide.Sell, OrderStatus.Placed),
            makeOrder(OrderSide.Sell, OrderStatus.Filled),
            makeOrder(OrderSide.Sell, OrderStatus.Filled),
            makeOrder(OrderSide.Buy, OrderStatus.Filled),
        ]);

        const result = await useCase.execute(GridFilter.Running, PAGE, PAGE_SIZE);

        expect(result.items[0].orderStats.filledCycles).toBe(2);
    });

    it('counts active buy and sell orders', async () => {
        const grid = makeGrid();
        grids.findGridsPaged.mockResolvedValue({ items: [grid], totalCount: 1, currentPage: 1 });
        grids.findOrdersByGridIds.mockResolvedValue([
            makeOrder(OrderSide.Buy, OrderStatus.Placed),
            makeOrder(OrderSide.Buy, OrderStatus.Pending),
            makeOrder(OrderSide.Sell, OrderStatus.Placed),
        ]);

        const result = await useCase.execute(GridFilter.Running, PAGE, PAGE_SIZE);

        expect(result.items[0].orderStats.activeBuys).toBe(2);
        expect(result.items[0].orderStats.activeSells).toBe(1);
    });

    it('computes weighted avg price for active orders', async () => {
        const grid = makeGrid();
        grids.findGridsPaged.mockResolvedValue({ items: [grid], totalCount: 1, currentPage: 1 });
        grids.findOrdersByGridIds.mockResolvedValue([
            makeOrder(OrderSide.Buy, OrderStatus.Placed, 90000, 1),
            makeOrder(OrderSide.Buy, OrderStatus.Placed, 80000, 1),
        ]);

        const result = await useCase.execute(GridFilter.Running, PAGE, PAGE_SIZE);

        expect(result.items[0].orderStats.avgActiveBuyPrice).toBeCloseTo(85000);
    });

    it('computes lowestActiveBuyPrice and highestActiveSellPrice', async () => {
        const grid = makeGrid();
        grids.findGridsPaged.mockResolvedValue({ items: [grid], totalCount: 1, currentPage: 1 });
        grids.findOrdersByGridIds.mockResolvedValue([
            makeOrder(OrderSide.Buy, OrderStatus.Placed, 90000, 1),
            makeOrder(OrderSide.Buy, OrderStatus.Placed, 85000, 1),
            makeOrder(OrderSide.Sell, OrderStatus.Placed, 95000, 1),
            makeOrder(OrderSide.Sell, OrderStatus.Placed, 100000, 1),
        ]);

        const result = await useCase.execute(GridFilter.Running, PAGE, PAGE_SIZE);

        expect(result.items[0].orderStats.lowestActiveBuyPrice).toBe(85000);
        expect(result.items[0].orderStats.highestActiveSellPrice).toBe(100000);
    });

    it('includes split orders in result', async () => {
        const grid = makeGrid();
        grids.findGridsPaged.mockResolvedValue({ items: [grid], totalCount: 1, currentPage: 1 });
        grids.findOrdersByGridIds.mockResolvedValue([
            makeOrder(OrderSide.Buy, OrderStatus.Placed),
            makeOrder(OrderSide.Sell, OrderStatus.Filled),
        ]);

        const result = await useCase.execute(GridFilter.Running, PAGE, PAGE_SIZE);

        expect(result.items[0].activeOrders).toHaveLength(1);
        expect(result.items[0].activeOrders[0].status).toBe(OrderStatus.Placed);
        expect(result.items[0].filledOrders).toHaveLength(1);
        expect(result.items[0].filledOrders[0].status).toBe(OrderStatus.Filled);
    });
});
