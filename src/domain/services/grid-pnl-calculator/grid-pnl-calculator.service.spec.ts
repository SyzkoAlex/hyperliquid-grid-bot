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
        const result = service.calculate([], 100);
        expect(result.gridProfit).toBe(0);
        expect(result.unrealizedPnl).toBe(0);
    });

    it('returns 0 when no filled orders', () => {
        const orders = [
            makeOrder(OrderSide.Buy, 100, 1, OrderStatus.Placed),
            makeOrder(OrderSide.Sell, 110, 1, OrderStatus.Pending),
        ];
        const result = service.calculate(orders, 105);
        expect(result.gridProfit).toBe(0);
        expect(result.unrealizedPnl).toBe(0);
    });

    it('returns positive gridProfit when sells exceed buys', () => {
        const orders = [makeOrder(OrderSide.Buy, 100, 1), makeOrder(OrderSide.Sell, 110, 1)];
        // sell: 110 - buy: 100 = +10; qtyHeld = 0
        const result = service.calculate(orders, 115);
        expect(result.gridProfit).toBeCloseTo(10);
        expect(result.unrealizedPnl).toBe(0);
    });

    it('returns negative gridProfit when buys exceed sells', () => {
        const orders = [makeOrder(OrderSide.Buy, 100, 2), makeOrder(OrderSide.Sell, 110, 1)];
        // sell: 110 - buy: 200 = -90
        const result = service.calculate(orders, 105);
        expect(result.gridProfit).toBeCloseTo(-90);
    });

    it('sums multiple filled orders correctly', () => {
        const orders = [
            makeOrder(OrderSide.Buy, 100, 1),
            makeOrder(OrderSide.Buy, 105, 1),
            makeOrder(OrderSide.Sell, 110, 1),
            makeOrder(OrderSide.Sell, 115, 1),
        ];
        // sell: 225, buy: 205 → +20; qtyHeld = 0
        const result = service.calculate(orders, 120);
        expect(result.gridProfit).toBeCloseTo(20);
        expect(result.unrealizedPnl).toBe(0);
    });

    it('ignores non-filled orders in mixed list', () => {
        const orders = [
            makeOrder(OrderSide.Buy, 100, 1),
            makeOrder(OrderSide.Buy, 90, 5, OrderStatus.Placed),
            makeOrder(OrderSide.Sell, 110, 1),
        ];
        // sell: 110 - buy: 100 = +10 (placed buy is ignored)
        const result = service.calculate(orders, 105);
        expect(result.gridProfit).toBeCloseTo(10);
    });

    it('calculates unrealized PnL for held quantity', () => {
        const orders = [makeOrder(OrderSide.Buy, 100, 2)];
        // no sells → qtyHeld = 2, avgBuyPrice = 100
        // unrealizedPnl = 2 × (110 − 100) = 20
        const result = service.calculate(orders, 110);
        expect(result.unrealizedPnl).toBeCloseTo(20);
    });

    it('calculates unrealized PnL with weighted average buy price', () => {
        const orders = [
            makeOrder(OrderSide.Buy, 100, 1),
            makeOrder(OrderSide.Buy, 120, 1),
            makeOrder(OrderSide.Sell, 130, 1),
        ];
        // filled buys: qty=2, avgBuyPrice = (100+120)/2 = 110
        // filled sells: qty=1 → qtyHeld = 1
        // unrealizedPnl = 1 × (140 − 110) = 30
        const result = service.calculate(orders, 140);
        expect(result.unrealizedPnl).toBeCloseTo(30);
    });

    it('returns negative unrealized PnL when price is below avgBuyPrice', () => {
        const orders = [makeOrder(OrderSide.Buy, 100, 1)];
        // currentPrice < avgBuyPrice → unrealized loss
        const result = service.calculate(orders, 90);
        expect(result.unrealizedPnl).toBeCloseTo(-10);
    });
});
