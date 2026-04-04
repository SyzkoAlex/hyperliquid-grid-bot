import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GridSnapshotFactory } from './grid-snapshot.factory';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { OrderDto } from '@components/grids/api/dto/order.dto';
import { GridMode } from '@domain/models/grid/grid-mode';
import { GridStatus } from '@domain/models/grid/grid-status';
import { OrderSide } from '@domain/models/order/order-side';
import { OrderStatus } from '@domain/models/order/order-status';
import { OrderType } from '@domain/models/order/order-type';

function makeGrid(): GridDto {
    return {
        id: 'grid-1',
        symbol: 'BTC',
        mode: GridMode.Neutral,
        status: GridStatus.Running,
        lowerPrice: 90000,
        upperPrice: 100000,
        levels: 10,
        investmentUSDC: 500,
        investmentBase: 0,
        trailingEnabled: false,
        trailingTriggerPercent: 5,
        trailingStepPercent: 2,
        trailingPartialClosePercent: 50,
    };
}

function makeOrder(
    side: OrderSide,
    status: OrderStatus,
    price = 95000,
    amount = 0.001,
    filledAt?: number,
): OrderDto {
    return {
        id: `order-${Math.random()}`,
        gridId: 'grid-1',
        symbol: 'BTC',
        side,
        status,
        type: OrderType.Limit,
        levelIndex: 1,
        price,
        amount,
        exchangeOrderId: null,
        createdAt: Date.now(),
        filledAt,
    };
}

describe('GridSnapshotFactory', () => {
    let pnlCalculator: { calculate: ReturnType<typeof vi.fn> };
    let factory: GridSnapshotFactory;

    beforeEach(() => {
        pnlCalculator = {
            calculate: vi.fn().mockReturnValue({ gridProfit: 0, unrealizedPnl: 0, totalFees: 0 }),
        };
        factory = new GridSnapshotFactory(pnlCalculator as any);
    });

    it('splits orders into active and filled', () => {
        const orders = [
            makeOrder(OrderSide.Buy, OrderStatus.Placed),
            makeOrder(OrderSide.Buy, OrderStatus.Pending),
            makeOrder(OrderSide.Sell, OrderStatus.Filled),
            makeOrder(OrderSide.Buy, OrderStatus.Cancelled),
        ];

        const snapshot = factory.create(makeGrid(), orders, 95000);

        expect(snapshot.activeOrders).toHaveLength(2);
        expect(snapshot.filledOrders).toHaveLength(1);
    });

    it('excludes filled orders without price', () => {
        const orders = [
            makeOrder(OrderSide.Sell, OrderStatus.Filled, 0),
            makeOrder(OrderSide.Sell, OrderStatus.Filled, 95000),
        ];
        orders[0].price = null;

        const snapshot = factory.create(makeGrid(), orders, 95000);

        expect(snapshot.filledOrders).toHaveLength(1);
        expect(snapshot.filledOrders[0].price).toBe(95000);
    });

    it('sorts filled orders by filledAt descending', () => {
        const older = makeOrder(OrderSide.Sell, OrderStatus.Filled, 90000, 0.001, 1000);
        const newer = makeOrder(OrderSide.Sell, OrderStatus.Filled, 95000, 0.001, 2000);

        const snapshot = factory.create(makeGrid(), [older, newer], 95000);

        expect(snapshot.filledOrders[0].filledAt).toBe(2000);
        expect(snapshot.filledOrders[1].filledAt).toBe(1000);
    });

    it('passes filled orders to pnl calculator', () => {
        const filled = makeOrder(OrderSide.Sell, OrderStatus.Filled, 95000, 0.5);

        factory.create(makeGrid(), [filled], 98000);

        expect(pnlCalculator.calculate).toHaveBeenCalledWith(
            [{ side: OrderSide.Sell, price: 95000, amount: 0.5, feeUsdc: undefined }],
            98000,
        );
    });

    it('passes feeUsdc from order to pnl calculator', () => {
        const filled: OrderDto = {
            ...makeOrder(OrderSide.Sell, OrderStatus.Filled, 95000, 0.5),
            feeUsdc: 0.038,
        };

        factory.create(makeGrid(), [filled], 98000);

        expect(pnlCalculator.calculate).toHaveBeenCalledWith(
            [{ side: OrderSide.Sell, price: 95000, amount: 0.5, feeUsdc: 0.038 }],
            98000,
        );
    });

    it('returns pnl from calculator', () => {
        pnlCalculator.calculate.mockReturnValue({
            gridProfit: 42,
            unrealizedPnl: -5,
            totalFees: 0,
        });

        const snapshot = factory.create(makeGrid(), [], 95000);

        expect(snapshot.pnl.gridProfit).toBe(42);
        expect(snapshot.pnl.unrealizedPnl).toBe(-5);
    });

    it('sets currentPrice on snapshot', () => {
        const snapshot = factory.create(makeGrid(), [], 98000);
        expect(snapshot.currentPrice).toBe(98000);
    });

    it('computes orderStats correctly', () => {
        const orders = [
            makeOrder(OrderSide.Buy, OrderStatus.Placed),
            makeOrder(OrderSide.Sell, OrderStatus.Placed),
            makeOrder(OrderSide.Sell, OrderStatus.Filled, 95000),
            makeOrder(OrderSide.Sell, OrderStatus.Filled, 95000),
        ];

        const snapshot = factory.create(makeGrid(), orders, 95000);

        expect(snapshot.orderStats.activeBuys).toBe(1);
        expect(snapshot.orderStats.activeSells).toBe(1);
        expect(snapshot.orderStats.filledCycles).toBe(2);
    });
});
