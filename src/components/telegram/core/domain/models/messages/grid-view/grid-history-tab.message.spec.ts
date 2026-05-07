import { describe, expect, it } from 'vitest';
import { GridHistoryTabMessage } from './grid-history-tab.message';
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
        stopLossEnabled: false,
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

function makeData(grid: GridDto, filledOrders: OrderDto[] = []): GridSnapshot {
    return {
        grid,
        pnl: DEFAULT_PNL,
        currentPrice: 95000,
        orderStats: DEFAULT_ORDER_STATS,
        activeOrders: [],
        filledOrders,
    };
}

describe('GridHistoryTabMessage', () => {
    it('shows Order History header with count of filled orders shown', () => {
        const filledOrders = [
            makeOrder(OrderSide.Sell, OrderStatus.Filled, 96000, 6),
            makeOrder(OrderSide.Buy, OrderStatus.Filled, 90000, 0),
        ];
        const result = GridHistoryTabMessage.create(makeData(makeGrid(), filledOrders)).text;
        expect(result).toContain('<b>Order History (2)</b>');
    });

    it('shows Order History header with count 0 when no filled orders', () => {
        const result = GridHistoryTabMessage.create(makeData(makeGrid(), [])).text;
        expect(result).toContain('<b>Order History (0)</b>');
    });

    it('shows current price line right after the header', () => {
        const result = GridHistoryTabMessage.create(makeData(makeGrid())).text;
        expect(result).toContain('<b>Current Price:</b> $95000');
    });

    it('does not show status/duration row', () => {
        const result = GridHistoryTabMessage.create(makeData(makeGrid(GridStatus.Running))).text;
        expect(result).not.toContain('Active');
        expect(result).not.toContain('🟢');
    });

    it('shows filled orders with side emoji', () => {
        // filledOrders are pre-filtered at DB level (Filled with non-null price)
        const filledOrders = [
            makeOrder(OrderSide.Sell, OrderStatus.Filled, 96000, 6),
            makeOrder(OrderSide.Buy, OrderStatus.Filled, 90000, 0),
        ];
        const result = GridHistoryTabMessage.create(makeData(makeGrid(), filledOrders)).text;
        expect(result).toContain('▲ Sell');
        expect(result).toContain('▼ Buy');
    });

    it('shows "no filled orders yet" when filledOrders is empty', () => {
        const result = GridHistoryTabMessage.create(makeData(makeGrid(), [])).text;
        expect(result).toContain('no filled orders yet');
    });

    it('does not show display limit note when no filled orders', () => {
        const result = GridHistoryTabMessage.create(makeData(makeGrid(), [])).text;
        expect(result).not.toContain('Showing last');
    });

    it('shows display limit note with actual count when filled orders exist', () => {
        const filledOrders = [
            makeOrder(OrderSide.Sell, OrderStatus.Filled, 96000, 6),
            makeOrder(OrderSide.Buy, OrderStatus.Filled, 90000, 0),
        ];
        const result = GridHistoryTabMessage.create(makeData(makeGrid(), filledOrders)).text;
        expect(result).toContain('Showing last 2 filled orders');
    });

    it('only shows the last 30 when there are more than 30 filled orders', () => {
        const filledOrders = Array.from({ length: 31 }, (_, i) =>
            makeOrder(OrderSide.Sell, OrderStatus.Filled, 96000, i % 10),
        );
        const result = GridHistoryTabMessage.create(makeData(makeGrid(), filledOrders)).text;
        expect(result.match(/▲ Sell/g)?.length).toBe(30);
        expect(result).toContain('<b>Order History (30)</b>');
        expect(result).toContain('Showing last 30 filled orders');
    });
});
