import { beforeEach, describe, expect, it } from 'vitest';
import { GridPnlCalculatorService } from './grid-pnl-calculator.service';
import { OrderSide } from '@domain/models/order/order-side';

function makeFilledOrder(side: OrderSide, price: number, amount: number) {
    return { side, price, amount };
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

    it('returns positive gridProfit when sells exceed buys', () => {
        const orders = [
            makeFilledOrder(OrderSide.Buy, 100, 1),
            makeFilledOrder(OrderSide.Sell, 110, 1),
        ];
        const result = service.calculate(orders, 115);
        expect(result.gridProfit).toBeCloseTo(10);
        expect(result.unrealizedPnl).toBe(0);
    });

    it('returns negative gridProfit when buys exceed sells', () => {
        const orders = [
            makeFilledOrder(OrderSide.Buy, 100, 2),
            makeFilledOrder(OrderSide.Sell, 110, 1),
        ];
        const result = service.calculate(orders, 105);
        expect(result.gridProfit).toBeCloseTo(-90);
    });

    it('sums multiple filled orders correctly', () => {
        const orders = [
            makeFilledOrder(OrderSide.Buy, 100, 1),
            makeFilledOrder(OrderSide.Buy, 105, 1),
            makeFilledOrder(OrderSide.Sell, 110, 1),
            makeFilledOrder(OrderSide.Sell, 115, 1),
        ];
        const result = service.calculate(orders, 120);
        expect(result.gridProfit).toBeCloseTo(20);
        expect(result.unrealizedPnl).toBe(0);
    });

    it('calculates unrealized PnL for held quantity', () => {
        const orders = [makeFilledOrder(OrderSide.Buy, 100, 2)];
        const result = service.calculate(orders, 110);
        expect(result.unrealizedPnl).toBeCloseTo(20);
    });

    it('calculates unrealized PnL with weighted average buy price', () => {
        const orders = [
            makeFilledOrder(OrderSide.Buy, 100, 1),
            makeFilledOrder(OrderSide.Buy, 120, 1),
            makeFilledOrder(OrderSide.Sell, 130, 1),
        ];
        const result = service.calculate(orders, 140);
        expect(result.unrealizedPnl).toBeCloseTo(30);
    });

    it('returns negative unrealized PnL when price is below avgBuyPrice', () => {
        const orders = [makeFilledOrder(OrderSide.Buy, 100, 1)];
        const result = service.calculate(orders, 90);
        expect(result.unrealizedPnl).toBeCloseTo(-10);
    });
});
