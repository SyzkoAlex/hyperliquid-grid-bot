import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GetGridsWithPnlUseCase } from './get-grids-with-pnl.use-case';
import { GridFilter } from './grid-filter';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { OrderDto } from '@components/grids/api/dto/order.dto';
import { GridMode } from '@domain/models/grid/grid-mode';
import { GridStatus } from '@domain/models/grid/grid-status';
import { OrderSide } from '@domain/models/order/order-side';
import { OrderStatus } from '@domain/models/order/order-status';
import { OrderType } from '@domain/models/order/order-type';

function makeGrid(status = GridStatus.Running): GridDto {
    return {
        id: '550e8400-e29b-41d4-a716-446655440000',
        symbol: 'BTC',
        mode: GridMode.Neutral,
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
    };
}

describe('GetGridsWithPnlUseCase', () => {
    let grids: {
        findAllGrids: ReturnType<typeof vi.fn>;
        findGridsByStatus: ReturnType<typeof vi.fn>;
        findGridById: ReturnType<typeof vi.fn>;
        findOrdersByGridId: ReturnType<typeof vi.fn>;
    };
    let tradingApi: {
        getCurrentPrice: ReturnType<typeof vi.fn>;
        getUserSpotState: ReturnType<typeof vi.fn>;
        pairExists: ReturnType<typeof vi.fn>;
    };
    let pnlCalculator: { calculate: ReturnType<typeof vi.fn> };
    let useCase: GetGridsWithPnlUseCase;

    beforeEach(() => {
        grids = {
            findAllGrids: vi.fn(),
            findGridsByStatus: vi.fn(),
            findGridById: vi.fn(),
            findOrdersByGridId: vi.fn(),
        };
        tradingApi = {
            getCurrentPrice: vi.fn().mockResolvedValue(95000),
            getUserSpotState: vi.fn(),
            pairExists: vi.fn(),
        };
        pnlCalculator = {
            calculate: vi.fn().mockReturnValue({ gridProfit: 0, unrealizedPnl: 0 }),
        };

        useCase = new GetGridsWithPnlUseCase(grids as any, tradingApi as any, pnlCalculator as any);
    });

    it('returns all grids by default', async () => {
        const grid = makeGrid();
        grids.findAllGrids.mockResolvedValue([grid]);
        grids.findOrdersByGridId.mockResolvedValue([]);

        const result = await useCase.execute();

        expect(grids.findAllGrids).toHaveBeenCalled();
        expect(result).toHaveLength(1);
        expect(result[0].grid).toBe(grid);
    });

    it('filters running grids when filter is Running', async () => {
        grids.findGridsByStatus.mockResolvedValue([]);

        await useCase.execute(GridFilter.Running);

        expect(grids.findGridsByStatus).toHaveBeenCalledWith(GridStatus.Running);
    });

    it('filters stopped grids when filter is Stopped', async () => {
        grids.findGridsByStatus.mockResolvedValue([]);

        await useCase.execute(GridFilter.Stopped);

        expect(grids.findGridsByStatus).toHaveBeenCalledWith(GridStatus.Stopped);
    });

    it('includes current price from trading api', async () => {
        const grid = makeGrid();
        grids.findAllGrids.mockResolvedValue([grid]);
        grids.findOrdersByGridId.mockResolvedValue([]);
        tradingApi.getCurrentPrice.mockResolvedValue(98000);

        const result = await useCase.execute();

        expect(result[0].currentPrice).toBe(98000);
    });

    it('passes current price to pnl calculator', async () => {
        const grid = makeGrid();
        grids.findAllGrids.mockResolvedValue([grid]);
        grids.findOrdersByGridId.mockResolvedValue([]);
        tradingApi.getCurrentPrice.mockResolvedValue(98000);

        await useCase.execute();

        expect(pnlCalculator.calculate).toHaveBeenCalledWith([], 98000);
    });

    it('returns pnl from calculator', async () => {
        const grid = makeGrid();
        grids.findAllGrids.mockResolvedValue([grid]);
        grids.findOrdersByGridId.mockResolvedValue([]);
        pnlCalculator.calculate.mockReturnValue({ gridProfit: 42.5, unrealizedPnl: -5 });

        const result = await useCase.execute();

        expect(result[0].pnl.gridProfit).toBe(42.5);
        expect(result[0].pnl.unrealizedPnl).toBe(-5);
    });

    it('counts filled sell orders as filledCycles', async () => {
        const grid = makeGrid();
        grids.findAllGrids.mockResolvedValue([grid]);
        grids.findOrdersByGridId.mockResolvedValue([
            makeOrder(OrderSide.Sell, OrderStatus.Filled),
            makeOrder(OrderSide.Sell, OrderStatus.Filled),
            makeOrder(OrderSide.Buy, OrderStatus.Filled),
            makeOrder(OrderSide.Sell, OrderStatus.Placed),
        ]);

        const result = await useCase.execute();

        expect(result[0].orderStats.filledCycles).toBe(2);
    });

    it('counts active buy and sell orders', async () => {
        const grid = makeGrid();
        grids.findAllGrids.mockResolvedValue([grid]);
        grids.findOrdersByGridId.mockResolvedValue([
            makeOrder(OrderSide.Buy, OrderStatus.Placed),
            makeOrder(OrderSide.Buy, OrderStatus.Pending),
            makeOrder(OrderSide.Sell, OrderStatus.Placed),
            makeOrder(OrderSide.Buy, OrderStatus.Filled),
        ]);

        const result = await useCase.execute();

        expect(result[0].orderStats.activeBuys).toBe(2);
        expect(result[0].orderStats.activeSells).toBe(1);
    });

    it('computes weighted avg price for active orders', async () => {
        const grid = makeGrid();
        grids.findAllGrids.mockResolvedValue([grid]);
        grids.findOrdersByGridId.mockResolvedValue([
            makeOrder(OrderSide.Buy, OrderStatus.Placed, 90000, 1),
            makeOrder(OrderSide.Buy, OrderStatus.Placed, 80000, 1),
        ]);

        const result = await useCase.execute();

        expect(result[0].orderStats.avgActiveBuyPrice).toBeCloseTo(85000);
    });

    it('computes lowestActiveBuyPrice and highestActiveSellPrice', async () => {
        const grid = makeGrid();
        grids.findAllGrids.mockResolvedValue([grid]);
        grids.findOrdersByGridId.mockResolvedValue([
            makeOrder(OrderSide.Buy, OrderStatus.Placed, 90000, 1),
            makeOrder(OrderSide.Buy, OrderStatus.Placed, 85000, 1),
            makeOrder(OrderSide.Sell, OrderStatus.Placed, 95000, 1),
            makeOrder(OrderSide.Sell, OrderStatus.Placed, 100000, 1),
        ]);

        const result = await useCase.execute();

        expect(result[0].orderStats.lowestActiveBuyPrice).toBe(85000);
        expect(result[0].orderStats.highestActiveSellPrice).toBe(100000);
    });

    it('includes raw orders in result', async () => {
        const grid = makeGrid();
        const orders = [makeOrder(OrderSide.Buy, OrderStatus.Placed)];
        grids.findAllGrids.mockResolvedValue([grid]);
        grids.findOrdersByGridId.mockResolvedValue(orders);

        const result = await useCase.execute();

        expect(result[0].orders).toBe(orders);
    });
});
