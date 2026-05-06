import { describe, expect, it } from 'vitest';
import { GridProfitTabMessage } from './grid-profit-tab.message';
import { GridSnapshot } from '@components/telegram/core/domain/models/grid-snapshot';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { GridStatus } from '@domain/models/grid/grid-status';
import { GridPnl } from '../../../../../core/domain/models/grid-pnl';
import { OrderStats } from '../../../../../core/domain/models/order-stats';

function makeGrid(status: GridStatus = GridStatus.Running, startedAt?: number): GridDto {
    return {
        id: '550e8400-e29b-41d4-a716-446655440000',
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

function makeData(
    grid: GridDto,
    pnl: GridPnl = DEFAULT_PNL,
    orderStats: OrderStats = DEFAULT_ORDER_STATS,
): GridSnapshot {
    return { grid, pnl, currentPrice: 95000, orderStats, activeOrders: [], filledOrders: [] };
}

describe('GridProfitTabMessage', () => {
    it('shows Total PnL, Grid Profit, Unrealized sections', () => {
        const pnl: GridPnl = { gridProfit: 4.5, unrealizedPnl: -2.1, totalFees: 0 };
        const result = GridProfitTabMessage.create(makeData(makeGrid(), pnl)).text;
        expect(result).toContain('Total PnL:');
        expect(result).toContain('Grid Profit:');
        expect(result).toContain('Unrealized:');
    });

    it('shows Grid APR on its own line', () => {
        const result = GridProfitTabMessage.create(makeData(makeGrid())).text;
        expect(result).toContain('Grid APR:');
    });

    it('shows — for Grid APR when grid started less than 1 hour ago', () => {
        const startedAt = Date.now() - 30 * 60 * 1000; // 30 min ago
        const grid = makeGrid(GridStatus.Running, startedAt);
        const result = GridProfitTabMessage.create(makeData(grid)).text;
        expect(result).toContain('Grid APR:</b>     —');
    });

    it('calculates correct Grid APR for a 3-day old grid', () => {
        // profit=$36.5, totalInvestment=$500 + 0.001*95000=$595, runningHours=72 → runningDays=3
        // APR = (36.5 / 595 / 3) * 365 * 100 ≈ 746.6%
        const startedAt = Date.now() - 72 * 60 * 60 * 1000;
        const grid = makeGrid(GridStatus.Running, startedAt);
        const pnl: GridPnl = { gridProfit: 36.5, unrealizedPnl: 0, totalFees: 0 };
        const result = GridProfitTabMessage.create(makeData(grid, pnl)).text;
        expect(result).toContain('Grid APR:');
        expect(result).toMatch(/Grid APR:.*\+7[0-9]{2}\./); // 7xx.x%
    });

    it('shows grid short id in header', () => {
        expect(GridProfitTabMessage.create(makeData(makeGrid())).text).toContain('Grid (');
    });

    it('shows Investment and levels', () => {
        const result = GridProfitTabMessage.create(makeData(makeGrid())).text;
        expect(result).toContain('Investment:');
        expect(result).toContain('10 levels');
    });

    it('shows Profitable Trades from filledCycles', () => {
        expect(GridProfitTabMessage.create(makeData(makeGrid())).text).toContain(
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
        const result = GridProfitTabMessage.create(makeData(grid)).text;
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
        const result = GridProfitTabMessage.create(makeData(grid)).text;
        expect(result).toContain('$595');
    });

    it('shows Entry Price when creationPrice is set', () => {
        const result = GridProfitTabMessage.create(makeData(makeGrid())).text;
        expect(result).toContain('Entry Price:</b> $95000');
    });

    it('shows — for Entry Price when creationPrice is undefined', () => {
        const grid: GridDto = { ...makeGrid(), creationPrice: undefined };
        const result = GridProfitTabMessage.create(makeData(grid)).text;
        expect(result).toContain('Entry Price:</b> —');
    });
});
