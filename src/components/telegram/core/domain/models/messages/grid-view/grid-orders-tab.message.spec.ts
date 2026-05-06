import { describe, expect, it } from 'vitest';
import { GridOrdersTabMessage } from './grid-orders-tab.message';
import { GridSnapshot } from '@components/telegram/core/domain/models/grid-snapshot';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { OrderDto } from '@components/grids/api/dto/order.dto';
import { GridStatus } from '@domain/models/grid/grid-status';
import { OrderSide } from '@domain/models/order/order-side';
import { OrderStatus } from '@domain/models/order/order-status';
import { OrderType } from '@domain/models/order/order-type';
import { GridPnl } from '@components/telegram/core/domain/models/grid-pnl';
import { OrderStats } from '@components/telegram/core/domain/models/order-stats';

function makeGrid(status: GridStatus = GridStatus.Running): GridDto {
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
        startedAt: undefined,
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
        createdAt: Date.now(),
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

function makeData(grid: GridDto, activeOrders: OrderDto[] = []): GridSnapshot {
    return {
        grid,
        pnl: DEFAULT_PNL,
        currentPrice: 95000,
        orderStats: DEFAULT_ORDER_STATS,
        activeOrders,
        filledOrders: [],
    };
}

describe('GridOrdersTabMessage', () => {
    it('shows Active Orders header', () => {
        expect(GridOrdersTabMessage.create(makeData(makeGrid())).text).toContain('Active Orders');
    });

    it('shows individual active orders with price and side, without level numbers', () => {
        const activeOrders = [
            makeOrder(OrderSide.Buy, OrderStatus.Placed, 90000, 0),
            makeOrder(OrderSide.Sell, OrderStatus.Placed, 96000, 6),
        ];
        const result = GridOrdersTabMessage.create(makeData(makeGrid(), activeOrders)).text;
        expect(result).toContain('▼ Buy');
        expect(result).toContain('▲ Sell');
        expect(result).toContain('$90000');
        expect(result).toContain('$96000');
        expect(result).not.toContain('Lv.');
    });

    it('shows "no active orders" when list is empty', () => {
        const result = GridOrdersTabMessage.create(makeData(makeGrid(), [])).text;
        expect(result).toContain('no active orders');
    });

    it('sorts active orders by price descending', () => {
        const activeOrders = [
            makeOrder(OrderSide.Buy, OrderStatus.Placed, 90000, 0),
            makeOrder(OrderSide.Sell, OrderStatus.Placed, 96000, 6),
        ];
        const result = GridOrdersTabMessage.create(makeData(makeGrid(), activeOrders)).text;
        const sellPos = result.indexOf('▲ Sell');
        const buyPos = result.indexOf('▼ Buy');
        expect(sellPos).toBeLessThan(buyPos); // sell at 96000 appears before buy at 90000
    });

    it('displays all orders provided in activeOrders without level numbers', () => {
        // activeOrders are pre-filtered at DB level (Pending/Placed only)
        const activeOrders = [
            makeOrder(OrderSide.Buy, OrderStatus.Placed, 90000, 0),
            makeOrder(OrderSide.Sell, OrderStatus.Placed, 96000, 6),
        ];
        const result = GridOrdersTabMessage.create(makeData(makeGrid(), activeOrders)).text;
        expect(result).toContain('$90000');
        expect(result).toContain('$96000');
        expect(result).not.toContain('Lv.');
    });
});
