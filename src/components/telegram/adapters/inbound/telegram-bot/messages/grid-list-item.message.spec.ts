import { describe, expect, it } from 'vitest';
import { GridCardData, GridListItemMessage } from './grid-list-item.message';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { OrderDto } from '@components/grids/api/dto/order.dto';
import { GridMode } from '@domain/models/grid/grid-mode';
import { GridStatus } from '@domain/models/grid/grid-status';
import { OrderSide } from '@domain/models/order/order-side';
import { OrderStatus } from '@domain/models/order/order-status';
import { OrderType } from '@domain/models/order/order-type';
import { GridPnl, OrderStats } from '../../../../core/domain/models/grid-pnl';

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

function makeOrder(side: OrderSide, status: OrderStatus, price = 95000, levelIndex = 5): OrderDto {
    return {
        id: '660e8400-e29b-41d4-a716-446655440001',
        gridId: '550e8400-e29b-41d4-a716-446655440000',
        symbol: 'BTC',
        side,
        status,
        type: OrderType.Limit,
        levelIndex,
        price,
        amount: 0.001,
        exchangeOrderId: null,
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
    orders: OrderDto[] = [],
): GridCardData {
    return { grid, pnl, currentPrice: 95000, orderStats, orders };
}

describe('GridListItemMessage', () => {
    describe('fromCardData (list card)', () => {
        it('shows symbol as pair with /USDC', () => {
            expect(GridListItemMessage.fromCardData(makeData(makeGrid()))).toContain('BTC/USDC');
        });

        it('shows 🟢 and Active for running grid', () => {
            const result = GridListItemMessage.fromCardData(makeData(makeGrid(GridStatus.Running)));
            expect(result).toContain('🟢');
            expect(result).toContain('Active');
        });

        it('shows 🔴 and Stopped for stopped grid', () => {
            const result = GridListItemMessage.fromCardData(makeData(makeGrid(GridStatus.Stopped)));
            expect(result).toContain('🔴');
            expect(result).toContain('Stopped');
        });

        it('shows total PnL (gridProfit + unrealizedPnl) with + sign', () => {
            const pnl: GridPnl = { gridProfit: 10, unrealizedPnl: 2.5 };
            expect(GridListItemMessage.fromCardData(makeData(makeGrid(), pnl))).toContain('+$12.5');
        });

        it('shows negative total PnL with - sign', () => {
            const pnl: GridPnl = { gridProfit: -3, unrealizedPnl: -2.25 };
            expect(GridListItemMessage.fromCardData(makeData(makeGrid(), pnl))).toContain('-$5.25');
        });

        it('shows total PnL percentage', () => {
            const pnl: GridPnl = { gridProfit: 10, unrealizedPnl: 2.5 };
            // 12.5 / 500 * 100 = 2.50%
            expect(GridListItemMessage.fromCardData(makeData(makeGrid(), pnl))).toContain('+2.50%');
        });

        it('shows current price', () => {
            expect(GridListItemMessage.fromCardData(makeData(makeGrid()))).toContain('95000');
        });

        it('shows price range', () => {
            const result = GridListItemMessage.fromCardData(makeData(makeGrid()));
            expect(result).toContain('90000');
            expect(result).toContain('100000');
        });

        it('shows profitable trades count', () => {
            expect(GridListItemMessage.fromCardData(makeData(makeGrid()))).toContain(
                'Profitable Trades:</b> 5',
            );
        });

        it('shows grid short id', () => {
            expect(GridListItemMessage.fromCardData(makeData(makeGrid()))).toContain('Grid (');
        });
    });

    describe('profitTab (detail view)', () => {
        it('shows Total PnL, Grid Profit, Unrealized sections', () => {
            const pnl: GridPnl = { gridProfit: 4.5, unrealizedPnl: -2.1 };
            const result = GridListItemMessage.profitTab(makeData(makeGrid(), pnl));
            expect(result).toContain('Total PnL:');
            expect(result).toContain('Grid Profit:');
            expect(result).toContain('Unrealized:');
        });

        it('shows Grid APR on its own line', () => {
            const result = GridListItemMessage.profitTab(makeData(makeGrid()));
            expect(result).toContain('Grid APR:');
        });

        it('shows — for Grid APR when grid started less than 1 hour ago', () => {
            const startedAt = Date.now() - 30 * 60 * 1000; // 30 min ago
            const grid = makeGrid(GridStatus.Running, startedAt);
            const result = GridListItemMessage.profitTab(makeData(grid));
            expect(result).toContain('Grid APR:</b>     —');
        });

        it('calculates correct Grid APR for a 3-day old grid', () => {
            // profit=$36.5, investment=$500, runningHours=72 → runningDays=3
            // APR = (36.5 / 500 / 3) * 365 * 100 = 888.17%
            const startedAt = Date.now() - 72 * 60 * 60 * 1000;
            const grid = makeGrid(GridStatus.Running, startedAt);
            const pnl: GridPnl = { gridProfit: 36.5, unrealizedPnl: 0 };
            const result = GridListItemMessage.profitTab(makeData(grid, pnl));
            // APR should be around 888%, not 14000%+
            expect(result).toContain('Grid APR:');
            expect(result).not.toContain('14568');
            expect(result).toMatch(/Grid APR:.*\+8[0-9]{2}\./); // 8xx.x%
        });

        it('shows Spot Grid Bot header', () => {
            expect(GridListItemMessage.profitTab(makeData(makeGrid()))).toContain('Spot Grid Bot');
        });

        it('shows Investment and levels', () => {
            const result = GridListItemMessage.profitTab(makeData(makeGrid()));
            expect(result).toContain('Investment:');
            expect(result).toContain('10 levels');
        });

        it('shows Profitable Trades from filledCycles', () => {
            expect(GridListItemMessage.profitTab(makeData(makeGrid()))).toContain(
                'Profitable Trades:</b> 5',
            );
        });
    });

    describe('ordersTab (active orders list)', () => {
        it('shows Active Orders header', () => {
            expect(GridListItemMessage.ordersTab(makeData(makeGrid()))).toContain('Active Orders');
        });

        it('shows individual active orders with price and level', () => {
            const orders = [
                makeOrder(OrderSide.Buy, OrderStatus.Placed, 90000, 0),
                makeOrder(OrderSide.Sell, OrderStatus.Placed, 96000, 6),
            ];
            const result = GridListItemMessage.ordersTab(
                makeData(makeGrid(), DEFAULT_PNL, DEFAULT_ORDER_STATS, orders),
            );
            expect(result).toContain('▼ Buy');
            expect(result).toContain('▲ Sell');
            expect(result).toContain('Lv.1');
            expect(result).toContain('Lv.7');
        });

        it('shows "no active orders" when list is empty', () => {
            const result = GridListItemMessage.ordersTab(
                makeData(makeGrid(), DEFAULT_PNL, DEFAULT_ORDER_STATS, []),
            );
            expect(result).toContain('no active orders');
        });

        it('sorts active orders by price descending', () => {
            const orders = [
                makeOrder(OrderSide.Buy, OrderStatus.Placed, 90000, 0),
                makeOrder(OrderSide.Sell, OrderStatus.Placed, 96000, 6),
            ];
            const result = GridListItemMessage.ordersTab(
                makeData(makeGrid(), DEFAULT_PNL, DEFAULT_ORDER_STATS, orders),
            );
            const sellPos = result.indexOf('▲ Sell');
            const buyPos = result.indexOf('▼ Buy');
            expect(sellPos).toBeLessThan(buyPos); // sell at 96000 appears before buy at 90000
        });

        it('ignores non-active orders', () => {
            const orders = [
                makeOrder(OrderSide.Buy, OrderStatus.Filled, 90000, 0),
                makeOrder(OrderSide.Sell, OrderStatus.Placed, 96000, 6),
            ];
            const result = GridListItemMessage.ordersTab(
                makeData(makeGrid(), DEFAULT_PNL, DEFAULT_ORDER_STATS, orders),
            );
            // only the placed sell should appear
            expect(result).not.toContain('Lv.1'); // filled buy at level 0
            expect(result).toContain('Lv.7'); // placed sell at level 6
        });
    });

    describe('historyTab (order history)', () => {
        it('shows Order History header', () => {
            expect(GridListItemMessage.historyTab(makeData(makeGrid()))).toContain('Order History');
        });

        it('shows only filled orders with side emoji', () => {
            const orders = [
                makeOrder(OrderSide.Sell, OrderStatus.Filled, 96000, 6),
                makeOrder(OrderSide.Buy, OrderStatus.Filled, 90000, 0),
                makeOrder(OrderSide.Buy, OrderStatus.Cancelled, 89000, 1), // should be excluded
            ];
            const result = GridListItemMessage.historyTab(
                makeData(makeGrid(), DEFAULT_PNL, DEFAULT_ORDER_STATS, orders),
            );
            expect(result).toContain('▲ Sell');
            expect(result).toContain('▼ Buy');
            expect(result).not.toContain('89000'); // cancelled order excluded
        });

        it('shows "no filled orders yet" when no filled orders', () => {
            const orders = [
                makeOrder(OrderSide.Buy, OrderStatus.Placed, 90000, 0),
                makeOrder(OrderSide.Buy, OrderStatus.Cancelled, 89000, 1),
            ];
            const result = GridListItemMessage.historyTab(
                makeData(makeGrid(), DEFAULT_PNL, DEFAULT_ORDER_STATS, orders),
            );
            expect(result).toContain('no filled orders yet');
        });

        it('always shows the display limit note', () => {
            const result = GridListItemMessage.historyTab(
                makeData(makeGrid(), DEFAULT_PNL, DEFAULT_ORDER_STATS, []),
            );
            expect(result).toContain('Showing last 30 filled orders');
        });

        it('only shows the last 30 when there are more than 30 filled orders', () => {
            const orders = Array.from({ length: 31 }, (_, i) =>
                makeOrder(OrderSide.Sell, OrderStatus.Filled, 96000, i % 10),
            );
            const result = GridListItemMessage.historyTab(
                makeData(makeGrid(), DEFAULT_PNL, DEFAULT_ORDER_STATS, orders),
            );
            expect(result.match(/▲ Sell/g)?.length).toBe(30);
        });
    });
});
