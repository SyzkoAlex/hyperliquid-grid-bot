import { describe, it, expect, beforeEach } from 'vitest';
import { GridPnlCalculatorService } from './grid-pnl-calculator.service';
import { Order } from '@domain/models/order/order';
import { OrderSide } from '@domain/models/order/order-side';
import { OrderType } from '@domain/models/order/order-type';
import { OrderStatus } from '@domain/models/order/order-status';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Price } from '@domain/models/primitives/price';
import { Decimal } from '@domain/models/primitives/decimal';
import { GridId } from '@domain/models/grid/grid-id';

const GRID_ID = GridId.from('550e8400-e29b-41d4-a716-446655440000');

function makeOrder(
    side: OrderSide,
    price: number,
    amount: number,
    status: OrderStatus = OrderStatus.Filled,
): Order {
    return Order.create({
        symbol: TradingSymbol.create('BTC'),
        type: OrderType.Limit,
        side,
        price: Price.from(price),
        amount: Decimal.from(amount),
        status,
        gridId: GRID_ID,
        levelIndex: 0,
    });
}

describe('GridPnlCalculatorService', () => {
    let service: GridPnlCalculatorService;

    beforeEach(() => {
        service = new GridPnlCalculatorService();
    });

    it('returns 0 for empty orders', () => {
        expect(service.calculate([])).toBe(0);
    });

    it('returns 0 when no filled orders', () => {
        const orders = [
            makeOrder(OrderSide.Buy, 100, 1, OrderStatus.Placed),
            makeOrder(OrderSide.Sell, 110, 1, OrderStatus.Pending),
        ];
        expect(service.calculate(orders)).toBe(0);
    });

    it('returns positive PnL when sells exceed buys', () => {
        const orders = [makeOrder(OrderSide.Buy, 100, 1), makeOrder(OrderSide.Sell, 110, 1)];
        // sell: 110 - buy: 100 = +10
        expect(service.calculate(orders)).toBeCloseTo(10);
    });

    it('returns negative PnL when buys exceed sells', () => {
        const orders = [makeOrder(OrderSide.Buy, 100, 2), makeOrder(OrderSide.Sell, 110, 1)];
        // sell: 110 - buy: 200 = -90
        expect(service.calculate(orders)).toBeCloseTo(-90);
    });

    it('sums multiple filled orders correctly', () => {
        const orders = [
            makeOrder(OrderSide.Buy, 100, 1),
            makeOrder(OrderSide.Buy, 105, 1),
            makeOrder(OrderSide.Sell, 110, 1),
            makeOrder(OrderSide.Sell, 115, 1),
        ];
        // sell: 110 + 115 = 225, buy: 100 + 105 = 205 → +20
        expect(service.calculate(orders)).toBeCloseTo(20);
    });

    it('ignores non-filled orders in mixed list', () => {
        const orders = [
            makeOrder(OrderSide.Buy, 100, 1),
            makeOrder(OrderSide.Buy, 90, 5, OrderStatus.Placed),
            makeOrder(OrderSide.Sell, 110, 1),
        ];
        // sell: 110 - buy: 100 = +10 (the placed buy is ignored)
        expect(service.calculate(orders)).toBeCloseTo(10);
    });
});
