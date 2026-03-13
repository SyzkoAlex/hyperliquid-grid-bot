import { describe, expect, it } from 'vitest';
import { GridProfitTabMessage } from './grid-profit-tab.message';
import { GridSnapshot } from '@components/telegram/core/domain/models/grid-snapshot';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { GridMode } from '@domain/models/grid/grid-mode';
import { GridStatus } from '@domain/models/grid/grid-status';
import { GridPnl } from '../../../../../core/domain/models/grid-pnl';
import { OrderStats } from '../../../../../core/domain/models/order-stats';

function makeGrid(status: GridStatus = GridStatus.Running, startedAt?: number): GridDto {
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
        startedAt,
    };
}

const DEFAULT_PNL: GridPnl = { gridProfit: 0, unrealizedPnl: 0 };
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
        const pnl: GridPnl = { gridProfit: 4.5, unrealizedPnl: -2.1 };
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
        // profit=$36.5, investment=$500, runningHours=72 → runningDays=3
        // APR = (36.5 / 500 / 3) * 365 * 100 = 888.17%
        const startedAt = Date.now() - 72 * 60 * 60 * 1000;
        const grid = makeGrid(GridStatus.Running, startedAt);
        const pnl: GridPnl = { gridProfit: 36.5, unrealizedPnl: 0 };
        const result = GridProfitTabMessage.create(makeData(grid, pnl)).text;
        expect(result).toContain('Grid APR:');
        expect(result).not.toContain('14568');
        expect(result).toMatch(/Grid APR:.*\+8[0-9]{2}\./); // 8xx.x%
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
});
