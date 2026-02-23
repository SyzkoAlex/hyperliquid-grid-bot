import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetGridsWithPnlUseCase } from './get-grids-with-pnl.use-case';
import { GridFilter } from './grid-filter';
import { Grid } from '@domain/models/grid/grid';
import { GridMode } from '@domain/models/grid/grid-mode';
import { GridStatus } from '@domain/models/grid/grid-status';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Price } from '@domain/models/primitives/price';
import { Decimal } from '@domain/models/primitives/decimal';
import { Order } from '@domain/models/order/order';
import { OrderSide } from '@domain/models/order/order-side';
import { OrderStatus } from '@domain/models/order/order-status';
import { OrderType } from '@domain/models/order/order-type';
import { GridId } from '@domain/models/grid/grid-id';

function makeGrid(status = GridStatus.Running): Grid {
    return Grid.create({
        symbol: TradingSymbol.create('BTC'),
        mode: GridMode.Neutral,
        status,
        lowerPrice: Price.from(90000),
        upperPrice: Price.from(100000),
        levels: 10,
        investmentUSDC: Decimal.from(500),
        investmentBase: Decimal.from(0.001),
    });
}

function makeOrder(side: OrderSide, status: OrderStatus, price = 95000, amount = 0.001): Order {
    return Order.create({
        symbol: TradingSymbol.create('BTC'),
        type: OrderType.Limit,
        side,
        price: Price.from(price),
        amount: Decimal.from(amount),
        status,
        gridId: GridId.create(),
        levelIndex: 5,
    });
}

describe('GetGridsWithPnlUseCase', () => {
    let gridRepository: {
        findAll: ReturnType<typeof vi.fn>;
        findManyByStatus: ReturnType<typeof vi.fn>;
        findOneById: ReturnType<typeof vi.fn>;
    };
    let orderRepository: { findManyByGridId: ReturnType<typeof vi.fn> };
    let infoClient: {
        getCurrentPrice: ReturnType<typeof vi.fn>;
        getUserSpotState: ReturnType<typeof vi.fn>;
        pairExists: ReturnType<typeof vi.fn>;
    };
    let pnlCalculator: { calculate: ReturnType<typeof vi.fn> };
    let useCase: GetGridsWithPnlUseCase;

    beforeEach(() => {
        gridRepository = {
            findAll: vi.fn(),
            findManyByStatus: vi.fn(),
            findOneById: vi.fn(),
        };
        orderRepository = { findManyByGridId: vi.fn() };
        infoClient = {
            getCurrentPrice: vi.fn().mockResolvedValue(Price.from(95000)),
            getUserSpotState: vi.fn(),
            pairExists: vi.fn(),
        };
        pnlCalculator = {
            calculate: vi.fn().mockReturnValue({ gridProfit: 0, unrealizedPnl: 0 }),
        };

        useCase = new GetGridsWithPnlUseCase(
            gridRepository as any,
            orderRepository as any,
            infoClient as any,
            pnlCalculator as any,
        );
    });

    it('returns all grids by default', async () => {
        const grid = makeGrid();
        gridRepository.findAll.mockResolvedValue([grid]);
        orderRepository.findManyByGridId.mockResolvedValue([]);

        const result = await useCase.execute();

        expect(gridRepository.findAll).toHaveBeenCalled();
        expect(result).toHaveLength(1);
        expect(result[0].grid).toBe(grid);
    });

    it('filters running grids when filter is Running', async () => {
        gridRepository.findManyByStatus.mockResolvedValue([]);

        await useCase.execute(GridFilter.Running);

        expect(gridRepository.findManyByStatus).toHaveBeenCalledWith(GridStatus.Running);
    });

    it('filters stopped grids when filter is Stopped', async () => {
        gridRepository.findManyByStatus.mockResolvedValue([]);

        await useCase.execute(GridFilter.Stopped);

        expect(gridRepository.findManyByStatus).toHaveBeenCalledWith(GridStatus.Stopped);
    });

    it('includes current price from info client', async () => {
        const grid = makeGrid();
        gridRepository.findAll.mockResolvedValue([grid]);
        orderRepository.findManyByGridId.mockResolvedValue([]);
        infoClient.getCurrentPrice.mockResolvedValue(Price.from(98000));

        const result = await useCase.execute();

        expect(result[0].currentPrice).toBe(98000);
    });

    it('passes current price to pnl calculator', async () => {
        const grid = makeGrid();
        gridRepository.findAll.mockResolvedValue([grid]);
        orderRepository.findManyByGridId.mockResolvedValue([]);
        infoClient.getCurrentPrice.mockResolvedValue(Price.from(98000));

        await useCase.execute();

        expect(pnlCalculator.calculate).toHaveBeenCalledWith([], 98000);
    });

    it('returns pnl from calculator', async () => {
        const grid = makeGrid();
        gridRepository.findAll.mockResolvedValue([grid]);
        orderRepository.findManyByGridId.mockResolvedValue([]);
        pnlCalculator.calculate.mockReturnValue({ gridProfit: 42.5, unrealizedPnl: -5 });

        const result = await useCase.execute();

        expect(result[0].pnl.gridProfit).toBe(42.5);
        expect(result[0].pnl.unrealizedPnl).toBe(-5);
    });

    it('counts filled sell orders as filledCycles', async () => {
        const grid = makeGrid();
        gridRepository.findAll.mockResolvedValue([grid]);
        orderRepository.findManyByGridId.mockResolvedValue([
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
        gridRepository.findAll.mockResolvedValue([grid]);
        orderRepository.findManyByGridId.mockResolvedValue([
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
        gridRepository.findAll.mockResolvedValue([grid]);
        orderRepository.findManyByGridId.mockResolvedValue([
            makeOrder(OrderSide.Buy, OrderStatus.Placed, 90000, 1),
            makeOrder(OrderSide.Buy, OrderStatus.Placed, 80000, 1),
        ]);

        const result = await useCase.execute();

        expect(result[0].orderStats.avgActiveBuyPrice).toBeCloseTo(85000);
    });

    it('computes lowestActiveBuyPrice and highestActiveSellPrice', async () => {
        const grid = makeGrid();
        gridRepository.findAll.mockResolvedValue([grid]);
        orderRepository.findManyByGridId.mockResolvedValue([
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
        gridRepository.findAll.mockResolvedValue([grid]);
        orderRepository.findManyByGridId.mockResolvedValue(orders);

        const result = await useCase.execute();

        expect(result[0].orders).toBe(orders);
    });
});
