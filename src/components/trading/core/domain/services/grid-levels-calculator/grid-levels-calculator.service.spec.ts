import { beforeEach, describe, expect, it } from 'vitest';
import { GridLevelsCalculatorService } from './grid-levels-calculator.service';
import { Price } from '@domain/models/primitives/price';
import { OrderSide } from '@domain/models/order/order-side';

describe('GridLevelsCalculatorService', () => {
    let service: GridLevelsCalculatorService;

    beforeEach(() => {
        service = new GridLevelsCalculatorService(10);
    });

    const defaults = {
        lowerPrice: 45000,
        upperPrice: 55000,
        levels: 10,
        investmentUSDC: 5000,
        investmentBase: 0.1,
    };

    function calc(
        overrides: Partial<typeof defaults> = {},
        currentPrice: Price = Price.from(50000),
    ) {
        const p = { ...defaults, ...overrides };
        return service.calculateLevelsWithSizes(
            p.lowerPrice,
            p.upperPrice,
            p.levels,
            p.investmentUSDC,
            p.investmentBase,
            currentPrice,
        );
    }

    describe('calculateLevelsWithSizes', () => {
        it('should calculate levels and sizes for neutral grid', () => {
            const currentPrice = Price.from(50000);
            const result = calc({}, currentPrice);

            expect(result).toHaveLength(11);

            const buyLevels = result.filter((l) => l.side === OrderSide.Buy);
            const sellLevels = result.filter((l) => l.side === OrderSide.Sell);

            expect(buyLevels.length).toBeGreaterThan(0);
            expect(sellLevels.length).toBeGreaterThan(0);
            expect(buyLevels.length + sellLevels.length).toBe(11);

            result.forEach((level) => {
                expect(level.price).toBeDefined();
                expect(level.price.toNumber()).toBeGreaterThan(0);
            });

            buyLevels.forEach((level) => {
                expect(level.price.toNumber()).toBeLessThan(currentPrice.toNumber());
            });

            sellLevels.forEach((level) => {
                expect(level.price.toNumber()).toBeGreaterThanOrEqual(currentPrice.toNumber());
            });
        });

        it('should distribute capital evenly across buy levels', () => {
            const currentPrice = Price.from(45000);
            const result = calc({ lowerPrice: 40000, upperPrice: 50000, levels: 5 }, currentPrice);

            const buyLevels = result.filter((l) => l.side === OrderSide.Buy);
            const expectedQuotePerLevel = 5000 / buyLevels.length;

            buyLevels.forEach((level) => {
                expect(level.amountUSDC).toBeCloseTo(expectedQuotePerLevel, 2);
            });
        });

        it('should distribute base tokens evenly across sell levels', () => {
            const currentPrice = Price.from(55000);
            const result = calc(
                { lowerPrice: 50000, upperPrice: 60000, levels: 5, investmentUSDC: 3000 },
                currentPrice,
            );

            const sellLevels = result.filter((l) => l.side === OrderSide.Sell);
            const expectedBasePerLevel = 0.1 / sellLevels.length;

            sellLevels.forEach((level) => {
                expect(level.amountBase).toBeCloseTo(expectedBasePerLevel, 5);
            });
        });

        it('should split orders at current price', () => {
            const result = calc(
                { lowerPrice: 2000, upperPrice: 3000, investmentBase: 2 },
                Price.from(2500),
            );

            const buyLevels = result.filter((l) => l.side === OrderSide.Buy);
            const sellLevels = result.filter((l) => l.side === OrderSide.Sell);

            expect(buyLevels.length).toBeGreaterThan(0);
            expect(sellLevels.length).toBeGreaterThan(0);
        });

        it('should handle all sell levels when price below lower bound', () => {
            const result = calc(
                { lowerPrice: 100, upperPrice: 150, investmentBase: 50 },
                Price.from(80),
            );

            const sellLevels = result.filter((l) => l.side === OrderSide.Sell);
            expect(sellLevels).toHaveLength(11);
        });

        it('should calculate correct amounts for buy orders', () => {
            const result = calc(
                { lowerPrice: 45000, upperPrice: 50000, levels: 5 },
                Price.from(55000),
            );

            result.forEach((level) => {
                expect(level.side).toBe(OrderSide.Buy);
                expect(level.amountUSDC).toBeDefined();
                expect(level.amountBase).toBeDefined();

                const expectedBase = level.amountUSDC! / level.price.toNumber();
                expect(level.amountBase).toBeCloseTo(expectedBase, 10);
            });
        });

        it('should calculate correct amounts for sell orders', () => {
            const result = calc(
                { lowerPrice: 50000, upperPrice: 55000, levels: 5, investmentUSDC: 3000 },
                Price.from(45000),
            );

            result.forEach((level) => {
                expect(level.side).toBe(OrderSide.Sell);
                expect(level.amountBase).toBeDefined();
                expect(level.amountUSDC).toBeDefined();

                const expectedQuote = level.amountBase! * level.price.toNumber();
                expect(level.amountUSDC).toBeCloseTo(expectedQuote, 2);
            });
        });
    });
});
