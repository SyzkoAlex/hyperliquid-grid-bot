import { describe, expect, it } from 'vitest';
import { countBuySellOrders } from './count-buy-sell-orders';

describe('countBuySellOrders', () => {
    it('splits orders below and above the current price', () => {
        // prices: 74, 76, 78, 80, 82, 84 — currentPrice 77.66 falls between 76 and 78
        const result = countBuySellOrders(6, 74, 84, 77.66);
        expect(result).toEqual({ buyOrders: 2, sellOrders: 4 });
    });

    it('counts sum to orderCount', () => {
        const result = countBuySellOrders(9, 74, 84, 77.66);
        expect(result.buyOrders + result.sellOrders).toBe(9);
    });

    it('treats the lower bound as a buy order when strictly below currentPrice', () => {
        const result = countBuySellOrders(5, 74, 84, 90);
        expect(result).toEqual({ buyOrders: 5, sellOrders: 0 });
    });

    it('treats the upper bound as a sell order when currentPrice is below it', () => {
        const result = countBuySellOrders(5, 74, 84, 70);
        expect(result).toEqual({ buyOrders: 0, sellOrders: 5 });
    });

    it('treats an order priced exactly at currentPrice as a sell order', () => {
        // prices: 74, 79, 84 — currentPrice exactly matches the middle order
        const result = countBuySellOrders(3, 74, 84, 79);
        expect(result).toEqual({ buyOrders: 1, sellOrders: 2 });
    });

    it('uses (orderCount - 1) spacing so both bounds are included as orders', () => {
        // orderCount=2 means only the two bounds themselves — no division by zero
        const result = countBuySellOrders(2, 74, 84, 79);
        expect(result).toEqual({ buyOrders: 1, sellOrders: 1 });
    });
});
