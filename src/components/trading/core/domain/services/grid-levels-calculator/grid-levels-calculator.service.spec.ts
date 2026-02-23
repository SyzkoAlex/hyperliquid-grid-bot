import { beforeEach, describe, expect, it } from 'vitest';
import { GridLevelsCalculatorService } from './grid-levels-calculator.service';
import { Grid } from '@domain/models/grid/grid';
import { GridMode } from '@domain/models/grid/grid-mode';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Price } from '@domain/models/primitives/price';
import { Decimal } from '@domain/models/primitives/decimal';
import { OrderSide } from '@domain/models/order/order-side';

describe('GridLevelsCalculatorService', () => {
    let service: GridLevelsCalculatorService;

    beforeEach(() => {
        service = new GridLevelsCalculatorService(10);
    });

    describe('calculateLevelsWithSizes', () => {
        it('should calculate levels and sizes for neutral grid', () => {
            const grid = Grid.create({
                symbol: TradingSymbol.create('BTC'),
                mode: GridMode.Neutral,
                lowerPrice: Price.from(45000),
                upperPrice: Price.from(55000),
                levels: 10,
                investmentUSDC: Decimal.from(5000), // $5,000 for buys
                investmentBase: Decimal.from(0.1), // 0.1 BTC for sells
                trailingEnabled: false,
                trailingTriggerPercent: 5,
                trailingStepPercent: 10,
                trailingPartialClosePercent: 50,
            });

            const currentPrice = Price.from(50000);
            const result = service.calculateLevelsWithSizes(grid, currentPrice);

            // Should have 10 levels
            expect(result).toHaveLength(10);

            // Check that levels are divided into buys and sells
            const buyLevels = result.filter((l) => l.side === OrderSide.Buy);
            const sellLevels = result.filter((l) => l.side === OrderSide.Sell);

            expect(buyLevels.length).toBeGreaterThan(0);
            expect(sellLevels.length).toBeGreaterThan(0);
            expect(buyLevels.length + sellLevels.length).toBe(10);

            // Check that all levels have prices
            result.forEach((level) => {
                expect(level.price).toBeDefined();
                expect(level.price.toNumber()).toBeGreaterThan(0);
            });

            // Check that buy levels are below current price
            buyLevels.forEach((level) => {
                expect(level.price.toNumber()).toBeLessThan(currentPrice.toNumber());
            });

            // Check that sell levels are at or above current price
            sellLevels.forEach((level) => {
                expect(level.price.toNumber()).toBeGreaterThanOrEqual(currentPrice.toNumber());
            });
        });

        it('should distribute capital evenly across buy levels', () => {
            const grid = Grid.create({
                symbol: TradingSymbol.create('BTC'),
                mode: GridMode.Neutral,
                lowerPrice: Price.from(40000),
                upperPrice: Price.from(50000),
                levels: 5,
                investmentUSDC: Decimal.from(5000), // $5,000 for buys
                investmentBase: Decimal.from(0.1),
                trailingEnabled: false,
                trailingTriggerPercent: 5,
                trailingStepPercent: 10,
                trailingPartialClosePercent: 50,
            });

            // Current price = 45000
            // Levels: 40k, 42.5k, 45k, 47.5k, 50k
            // Below 45k: 40k, 42.5k (buy)
            // At/Above 45k: 45k, 47.5k, 50k (sell)

            const currentPrice = Price.from(45000);
            const result = service.calculateLevelsWithSizes(grid, currentPrice);

            const buyLevels = result.filter((l) => l.side === OrderSide.Buy);

            // Each buy level should get equal share of quote investment
            const expectedQuotePerLevel = 5000 / buyLevels.length;

            buyLevels.forEach((level) => {
                expect(level.amountUSDC).toBeCloseTo(expectedQuotePerLevel, 2);
            });
        });

        it('should distribute base tokens evenly across sell levels', () => {
            const grid = Grid.create({
                symbol: TradingSymbol.create('BTC'),
                mode: GridMode.Long,
                lowerPrice: Price.from(50000),
                upperPrice: Price.from(60000),
                levels: 5,
                investmentUSDC: Decimal.from(3000),
                investmentBase: Decimal.from(0.1), // 0.1 BTC for sells
                trailingEnabled: false,
                trailingTriggerPercent: 5,
                trailingStepPercent: 10,
                trailingPartialClosePercent: 50,
            });

            // Current price = 55000
            // Levels: 50k, 52.5k, 55k, 57.5k, 60k
            // Below 55k: 50k, 52.5k (buy)
            // At/Above 55k: 55k, 57.5k, 60k (sell)

            const currentPrice = Price.from(55000);
            const result = service.calculateLevelsWithSizes(grid, currentPrice);

            const sellLevels = result.filter((l) => l.side === OrderSide.Sell);

            // Each sell level should get equal share of base investment
            const expectedBasePerLevel = 0.1 / sellLevels.length;

            sellLevels.forEach((level) => {
                expect(level.amountBase).toBeCloseTo(expectedBasePerLevel, 5);
            });
        });

        it('should split orders at current price', () => {
            const grid = Grid.create({
                symbol: TradingSymbol.create('ETH'),
                mode: GridMode.Neutral,
                lowerPrice: Price.from(2000),
                upperPrice: Price.from(3000),
                levels: 10,
                investmentUSDC: Decimal.from(5000),
                investmentBase: Decimal.from(2),
                trailingEnabled: false,
                trailingTriggerPercent: 5,
                trailingStepPercent: 10,
                trailingPartialClosePercent: 50,
            });

            // Current price = 2500
            // Levels below 2500 are buy, at/above 2500 are sell

            const currentPrice = Price.from(2500);
            const result = service.calculateLevelsWithSizes(grid, currentPrice);

            const buyLevels = result.filter((l) => l.side === OrderSide.Buy);
            const sellLevels = result.filter((l) => l.side === OrderSide.Sell);

            // Should have both buy and sell levels
            expect(buyLevels.length).toBeGreaterThan(0);
            expect(sellLevels.length).toBeGreaterThan(0);
        });

        it('should handle all sell levels when price below lower bound', () => {
            const grid = Grid.create({
                symbol: TradingSymbol.create('SOL'),
                mode: GridMode.Neutral,
                lowerPrice: Price.from(100),
                upperPrice: Price.from(150),
                levels: 10,
                investmentUSDC: Decimal.from(5000),
                investmentBase: Decimal.from(50),
                trailingEnabled: false,
                trailingTriggerPercent: 5,
                trailingStepPercent: 10,
                trailingPartialClosePercent: 50,
            });

            const currentPrice = Price.from(80); // Below lower bound

            const result = service.calculateLevelsWithSizes(grid, currentPrice);

            // All levels should be sell orders
            const sellLevels = result.filter((l) => l.side === OrderSide.Sell);
            expect(sellLevels).toHaveLength(10);
        });

        it('should calculate correct amounts for buy orders', () => {
            const grid = Grid.create({
                symbol: TradingSymbol.create('BTC'),
                mode: GridMode.Neutral,
                lowerPrice: Price.from(45000),
                upperPrice: Price.from(50000),
                levels: 5,
                investmentUSDC: Decimal.from(5000),
                investmentBase: Decimal.from(0.1),
                trailingEnabled: false,
                trailingTriggerPercent: 5,
                trailingStepPercent: 10,
                trailingPartialClosePercent: 50,
            });

            const currentPrice = Price.from(55000); // All buys

            const result = service.calculateLevelsWithSizes(grid, currentPrice);

            result.forEach((level) => {
                expect(level.side).toBe(OrderSide.Buy);
                expect(level.amountUSDC).toBeDefined();
                expect(level.amountBase).toBeDefined();

                // amountBase should be amountUSDC / price
                const expectedBase = level.amountUSDC! / level.price.toNumber();
                expect(level.amountBase).toBeCloseTo(expectedBase, 10);
            });
        });

        it('should calculate correct amounts for sell orders', () => {
            const grid = Grid.create({
                symbol: TradingSymbol.create('BTC'),
                mode: GridMode.Long,
                lowerPrice: Price.from(50000),
                upperPrice: Price.from(55000),
                levels: 5,
                investmentUSDC: Decimal.from(3000),
                investmentBase: Decimal.from(0.1),
                trailingEnabled: false,
                trailingTriggerPercent: 5,
                trailingStepPercent: 10,
                trailingPartialClosePercent: 50,
            });

            const currentPrice = Price.from(45000); // All sells

            const result = service.calculateLevelsWithSizes(grid, currentPrice);

            result.forEach((level) => {
                expect(level.side).toBe(OrderSide.Sell);
                expect(level.amountBase).toBeDefined();
                expect(level.amountUSDC).toBeDefined();

                // amountUSDC should be amountBase * price
                const expectedQuote = level.amountBase! * level.price.toNumber();
                expect(level.amountUSDC).toBeCloseTo(expectedQuote, 2);
            });
        });
    });
});
