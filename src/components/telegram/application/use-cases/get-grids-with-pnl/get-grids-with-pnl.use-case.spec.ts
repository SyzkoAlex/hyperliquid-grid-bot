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

function makeOrder(side: OrderSide, status: OrderStatus): Order {
    return Order.create({
        symbol: TradingSymbol.create('BTC'),
        type: OrderType.Limit,
        side,
        price: Price.from(95000),
        amount: Decimal.from(0.001),
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
        pnlCalculator = { calculate: vi.fn().mockReturnValue(0) };

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
        orderRepository.findManyByGridId.mockResolvedValue([]);

        await useCase.execute(GridFilter.Running);

        expect(gridRepository.findManyByStatus).toHaveBeenCalledWith(GridStatus.Running);
    });

    it('filters stopped grids when filter is Stopped', async () => {
        gridRepository.findManyByStatus.mockResolvedValue([]);
        orderRepository.findManyByGridId.mockResolvedValue([]);

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

    it('counts only filled sell orders as profitable trades', async () => {
        const grid = makeGrid();
        gridRepository.findAll.mockResolvedValue([grid]);
        orderRepository.findManyByGridId.mockResolvedValue([
            makeOrder(OrderSide.Sell, OrderStatus.Filled),
            makeOrder(OrderSide.Sell, OrderStatus.Filled),
            makeOrder(OrderSide.Buy, OrderStatus.Filled),
            makeOrder(OrderSide.Sell, OrderStatus.Placed),
        ]);

        const result = await useCase.execute();

        expect(result[0].profitableTrades).toBe(2);
    });

    it('returns pnl from calculator', async () => {
        const grid = makeGrid();
        gridRepository.findAll.mockResolvedValue([grid]);
        orderRepository.findManyByGridId.mockResolvedValue([]);
        pnlCalculator.calculate.mockReturnValue(42.5);

        const result = await useCase.execute();

        expect(result[0].pnl).toBe(42.5);
    });
});
