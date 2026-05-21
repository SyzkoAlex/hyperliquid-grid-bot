import { describe, expect, it } from 'vitest';
import { GridProfitTabMessage } from './grid-profit-tab.message';
import { GridSnapshot } from '@components/telegram/core/domain/models/grid-snapshot';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { OrderDto } from '@components/grids/api/dto/order.dto';
import { GridStatus } from '@domain/models/grid/grid-status';
import { OrderStatus } from '@domain/models/order/order-status';
import { OrderSide } from '@domain/models/order/order-side';
import { OrderType } from '@domain/models/order/order-type';
import { GridPnl } from '../../../../../core/domain/models/grid-pnl';
import { OrderStats } from '../../../../../core/domain/models/order-stats';

function makeGrid(status: GridStatus = GridStatus.Running, startedAt?: number): GridDto {
    return {
        id: '550e8400-e29b-41d4-a716-446655440000',
        userId: 'user-1',
        symbol: 'BTC',
        status,
        lowerPrice: 90000,
        upperPrice: 100000,
        levels: 10,
        investmentUSDC: 500,
        investmentBase: 0.001,
        creationPrice: 95000,
        trailingEnabled: false,
        trailingTriggerPercent: 5,
        trailingStepPercent: 2,
        trailingPartialClosePercent: 50,
        stopLossEnabled: false,
        startedAt,
    };
}

const DEFAULT_PNL: GridPnl = { gridProfit: 0, unrealizedPnl: 0, totalFees: 0 };
const DEFAULT_ORDER_STATS: OrderStats = {
    activeBuys: 4,
    activeSells: 5,
    avgActiveBuyPrice: 91000,
    avgActiveSellPrice: 96000,
    lowestActiveBuyPrice: 90000,
    highestActiveSellPrice: 100000,
    filledCycles: 5,
};

function makeOrder(id: string, price: number, side: OrderSide): OrderDto {
    return {
        id,
        gridId: 'grid-1',
        symbol: 'BTC',
        side,
        type: OrderType.Limit,
        status: OrderStatus.Placed,
        levelIndex: 0,
        price,
        amount: 0.001,
        createdAt: Date.now(),
        exchangeOrderId: null,
    };
}

function makeData(
    grid: GridDto,
    pnl: GridPnl = DEFAULT_PNL,
    orderStats: OrderStats = DEFAULT_ORDER_STATS,
    activeOrders: OrderDto[] = [],
): GridSnapshot {
    return { grid, pnl, currentPrice: 95000, orderStats, activeOrders, filledOrders: [] };
}

describe('GridProfitTabMessage', () => {
    it('shows Total PnL, Grid Profit, Unrealized sections', () => {
        const pnl: GridPnl = { gridProfit: 4.5, unrealizedPnl: -2.1, totalFees: 0 };
        const result = GridProfitTabMessage.create(makeData(makeGrid(), pnl), 'UTC').text;
        expect(result).toContain('Total PnL:');
        expect(result).toContain('Grid Profit:');
        expect(result).toContain('Unrealized:');
    });

    it('shows Grid APR on its own line', () => {
        const result = GridProfitTabMessage.create(makeData(makeGrid()), 'UTC').text;
        expect(result).toContain('Grid APR:');
    });

    it('shows — for Grid APR when grid started less than 1 hour ago', () => {
        const startedAt = Date.now() - 30 * 60 * 1000; // 30 min ago
        const grid = makeGrid(GridStatus.Running, startedAt);
        const result = GridProfitTabMessage.create(makeData(grid), 'UTC').text;
        expect(result).toContain('Grid APR:</b>     —');
    });

    it('calculates correct Grid APR for a 3-day old grid', () => {
        // profit=$36.5, totalInvestment=$500 + 0.001*95000=$595, runningHours=72 → runningDays=3
        // APR = (36.5 / 595 / 3) * 365 * 100 ≈ 746.6%
        const startedAt = Date.now() - 72 * 60 * 60 * 1000;
        const grid = makeGrid(GridStatus.Running, startedAt);
        const pnl: GridPnl = { gridProfit: 36.5, unrealizedPnl: 0, totalFees: 0 };
        const result = GridProfitTabMessage.create(makeData(grid, pnl), 'UTC').text;
        expect(result).toContain('Grid APR:');
        expect(result).toMatch(/Grid APR:.*\+7[0-9]{2}\./); // 7xx.x%
    });

    it('shows grid short id in header', () => {
        expect(GridProfitTabMessage.create(makeData(makeGrid()), 'UTC').text).toContain('Grid (');
    });

    it('shows Investment', () => {
        const result = GridProfitTabMessage.create(makeData(makeGrid()), 'UTC').text;
        expect(result).toContain('Investment:');
    });

    it('renders actual active order count in the Range summary', () => {
        const grid = makeGrid();
        const orders = Array.from({ length: 11 }, (_, i) =>
            makeOrder(`order-${i}`, 90000 + i * 1000, i < 5 ? OrderSide.Buy : OrderSide.Sell),
        );
        const result = GridProfitTabMessage.create(
            makeData(grid, DEFAULT_PNL, DEFAULT_ORDER_STATS, orders),
            'UTC',
        ).text;
        expect(result).toContain('11 orders');
        expect(result).not.toContain('levels');
    });

    it('renders 0 orders when no active orders', () => {
        const grid = makeGrid();
        const result = GridProfitTabMessage.create(makeData(grid), 'UTC').text;
        expect(result).toContain('0 orders');
    });

    it('shows Profitable Trades from filledCycles', () => {
        expect(GridProfitTabMessage.create(makeData(makeGrid()), 'UTC').text).toContain(
            'Profitable Trades:</b> 5',
        );
    });

    it('uses creationPrice for investment when creationPrice differs from currentPrice', () => {
        const grid: GridDto = {
            ...makeGrid(),
            investmentUSDC: 500,
            investmentBase: 0.001,
            creationPrice: 90000,
        };
        // investment = 500 + 0.001 * 90000 = 590, not 595
        const result = GridProfitTabMessage.create(makeData(grid), 'UTC').text;
        expect(result).toContain('$590');
        expect(result).not.toContain('$595');
    });

    it('falls back to currentPrice when creationPrice is undefined', () => {
        const grid: GridDto = {
            ...makeGrid(),
            investmentUSDC: 500,
            investmentBase: 0.001,
            creationPrice: undefined,
        };
        // investment = 500 + 0.001 * 95000 (currentPrice) = 595
        const result = GridProfitTabMessage.create(makeData(grid), 'UTC').text;
        expect(result).toContain('$595');
    });

    it('shows Entry Price when creationPrice is set', () => {
        const result = GridProfitTabMessage.create(makeData(makeGrid()), 'UTC').text;
        expect(result).toContain('Entry Price:</b> $95000');
    });

    it('shows — for Entry Price when creationPrice is undefined', () => {
        const grid: GridDto = { ...makeGrid(), creationPrice: undefined };
        const result = GridProfitTabMessage.create(makeData(grid), 'UTC').text;
        expect(result).toContain('Entry Price:</b> —');
    });

    describe('price label', () => {
        it('shows Current Price: for a running grid', () => {
            const grid = makeGrid(GridStatus.Running);
            const result = GridProfitTabMessage.create(makeData(grid), 'UTC').text;
            expect(result).toContain('Current Price:</b>');
            expect(result).not.toContain('Stop Price:');
        });

        it('shows Stop Price: for a stopped grid with stopPrice set', () => {
            const grid: GridDto = { ...makeGrid(GridStatus.Stopped), stopPrice: 92000 };
            const snapshot: GridSnapshot = { ...makeData(grid), currentPrice: 92000 };
            const result = GridProfitTabMessage.create(snapshot, 'UTC').text;
            expect(result).toContain('Stop Price:</b> $92000');
            expect(result).not.toContain('Current Price:');
        });

        it('shows Current Price: for a legacy stopped grid without stopPrice', () => {
            const grid: GridDto = { ...makeGrid(GridStatus.Stopped), stopPrice: undefined };
            const result = GridProfitTabMessage.create(makeData(grid), 'UTC').text;
            expect(result).toContain('Current Price:</b>');
            expect(result).not.toContain('Stop Price:');
        });
    });
});
