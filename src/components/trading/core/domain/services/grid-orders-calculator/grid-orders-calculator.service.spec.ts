import { beforeEach, describe, expect, it } from 'vitest';
import { GridOrdersCalculatorService } from './grid-orders-calculator.service';
import { Price } from '@domain/models/primitives/price';
import { OrderSide } from '@domain/models/order/order-side';

describe('GridOrdersCalculatorService', () => {
    let service: GridOrdersCalculatorService;

    const sellSizeBuffer = 0.005;

    beforeEach(() => {
        service = new GridOrdersCalculatorService(10, sellSizeBuffer);
    });

    const defaults = {
        lowerPrice: 45000,
        upperPrice: 55000,
        orderCount: 10,
        investmentUSDC: 5000,
        investmentBase: 0.1,
    };

    function calc(
        overrides: Partial<typeof defaults> = {},
        currentPrice: Price = Price.from(50000),
    ) {
        const p = { ...defaults, ...overrides };
        return service.calculateOrdersWithSizes(
            p.lowerPrice,
            p.upperPrice,
            p.orderCount,
            p.investmentUSDC,
            p.investmentBase,
            currentPrice,
        );
    }

    describe('calculateOrdersWithSizes', () => {
        it('should calculate orders and sizes for neutral grid', () => {
            const currentPrice = Price.from(50000);
            const result = calc({}, currentPrice);

            expect(result).toHaveLength(10);

            const buyOrders = result.filter((o) => o.side === OrderSide.Buy);
            const sellOrders = result.filter((o) => o.side === OrderSide.Sell);

            expect(buyOrders.length).toBeGreaterThan(0);
            expect(sellOrders.length).toBeGreaterThan(0);
            expect(buyOrders.length + sellOrders.length).toBe(10);

            result.forEach((order) => {
                expect(order.price).toBeDefined();
                expect(order.price.toNumber()).toBeGreaterThan(0);
            });

            buyOrders.forEach((order) => {
                expect(order.price.toNumber()).toBeLessThan(currentPrice.toNumber());
            });

            sellOrders.forEach((order) => {
                expect(order.price.toNumber()).toBeGreaterThanOrEqual(currentPrice.toNumber());
            });
        });

        it('should have the first order price at lowerPrice and the last at upperPrice', () => {
            const result = calc({}, Price.from(50000));

            expect(result[0].price.toNumber()).toBe(45000);
            expect(result[result.length - 1].price.toNumber()).toBe(55000);
        });

        it('should distribute capital evenly across buy orders', () => {
            const currentPrice = Price.from(45000);
            const result = calc(
                { lowerPrice: 40000, upperPrice: 50000, orderCount: 5 },
                currentPrice,
            );

            const buyOrders = result.filter((o) => o.side === OrderSide.Buy);
            const expectedQuotePerOrder = 5000 / buyOrders.length;

            buyOrders.forEach((order) => {
                expect(order.amountUSDC).toBeCloseTo(expectedQuotePerOrder, 2);
            });
        });

        it('should distribute base tokens evenly across sell orders', () => {
            const currentPrice = Price.from(55000);
            const result = calc(
                { lowerPrice: 50000, upperPrice: 60000, orderCount: 5, investmentUSDC: 3000 },
                currentPrice,
            );

            const sellOrders = result.filter((o) => o.side === OrderSide.Sell);
            const expectedBasePerOrder = (0.1 / sellOrders.length) * (1 + sellSizeBuffer);

            sellOrders.forEach((order) => {
                expect(order.amountBase).toBeCloseTo(expectedBasePerOrder, 5);
            });
        });

        it('should split orders at current price', () => {
            const result = calc(
                { lowerPrice: 2000, upperPrice: 3000, investmentBase: 2 },
                Price.from(2500),
            );

            const buyOrders = result.filter((o) => o.side === OrderSide.Buy);
            const sellOrders = result.filter((o) => o.side === OrderSide.Sell);

            expect(buyOrders.length).toBeGreaterThan(0);
            expect(sellOrders.length).toBeGreaterThan(0);
        });

        it('should handle all sell orders when price below lower bound', () => {
            const result = calc(
                { lowerPrice: 100, upperPrice: 150, investmentBase: 50 },
                Price.from(80),
            );

            const sellOrders = result.filter((o) => o.side === OrderSide.Sell);
            expect(sellOrders).toHaveLength(10);
        });

        it('should calculate correct amounts for buy orders', () => {
            const result = calc(
                { lowerPrice: 45000, upperPrice: 50000, orderCount: 5 },
                Price.from(55000),
            );

            result.forEach((order) => {
                expect(order.side).toBe(OrderSide.Buy);
                expect(order.amountUSDC).toBeDefined();
                expect(order.amountBase).toBeDefined();

                const expectedBase = order.amountUSDC! / order.price.toNumber();
                expect(order.amountBase).toBeCloseTo(expectedBase, 10);
            });
        });

        it('should calculate correct amounts for sell orders', () => {
            const result = calc(
                { lowerPrice: 50000, upperPrice: 55000, orderCount: 5, investmentUSDC: 3000 },
                Price.from(45000),
            );

            result.forEach((order) => {
                expect(order.side).toBe(OrderSide.Sell);
                expect(order.amountBase).toBeDefined();
                expect(order.amountUSDC).toBeDefined();

                const expectedQuote = order.amountBase! * order.price.toNumber();
                expect(order.amountUSDC).toBeCloseTo(expectedQuote, 2);
            });
        });
    });
});
