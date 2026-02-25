import { beforeEach, describe, expect, it } from 'vitest';
import { GridLevelsCalculatorService } from './grid-levels-calculator.service';
import { GridDto } from '@/components/grids/api/dto/grid.dto';
import { GridMode } from '@domain/models/grid/grid-mode';
import { GridStatus } from '@domain/models/grid/grid-status';
import { Price } from '@domain/models/primitives/price';
import { OrderSide } from '@domain/models/order/order-side';

describe('GridLevelsCalculatorService', () => {
    let service: GridLevelsCalculatorService;

    beforeEach(() => {
        service = new GridLevelsCalculatorService(10);
    });

    function makeGrid(overrides: Partial<GridDto> = {}): GridDto {
        return {
            id: crypto.randomUUID(),
            symbol: 'BTC',
            mode: GridMode.Neutral,
            status: GridStatus.Running,
            lowerPrice: 45000,
            upperPrice: 55000,
            levels: 10,
            investmentUSDC: 5000,
            investmentBase: 0.1,
            trailingEnabled: false,
            trailingTriggerPercent: 5,
            trailingStepPercent: 10,
            trailingPartialClosePercent: 50,
            ...overrides,
        };
    }

    describe('calculateLevelsWithSizes', () => {
        it('should calculate levels and sizes for neutral grid', () => {
            const grid = makeGrid();
            const currentPrice = Price.from(50000);
            const result = service.calculateLevelsWithSizes(grid, currentPrice);

            expect(result).toHaveLength(10);

            const buyLevels = result.filter((l) => l.side === OrderSide.Buy);
            const sellLevels = result.filter((l) => l.side === OrderSide.Sell);

            expect(buyLevels.length).toBeGreaterThan(0);
            expect(sellLevels.length).toBeGreaterThan(0);
            expect(buyLevels.length + sellLevels.length).toBe(10);

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
            const grid = makeGrid({
                lowerPrice: 40000,
                upperPrice: 50000,
                levels: 5,
            });

            const currentPrice = Price.from(45000);
            const result = service.calculateLevelsWithSizes(grid, currentPrice);

            const buyLevels = result.filter((l) => l.side === OrderSide.Buy);

            const expectedQuotePerLevel = 5000 / buyLevels.length;

            buyLevels.forEach((level) => {
                expect(level.amountUSDC).toBeCloseTo(expectedQuotePerLevel, 2);
            });
        });

        it('should distribute base tokens evenly across sell levels', () => {
            const grid = makeGrid({
                mode: GridMode.Long,
                lowerPrice: 50000,
                upperPrice: 60000,
                levels: 5,
                investmentUSDC: 3000,
            });

            const currentPrice = Price.from(55000);
            const result = service.calculateLevelsWithSizes(grid, currentPrice);

            const sellLevels = result.filter((l) => l.side === OrderSide.Sell);

            const expectedBasePerLevel = 0.1 / sellLevels.length;

            sellLevels.forEach((level) => {
                expect(level.amountBase).toBeCloseTo(expectedBasePerLevel, 5);
            });
        });

        it('should split orders at current price', () => {
            const grid = makeGrid({
                symbol: 'ETH',
                lowerPrice: 2000,
                upperPrice: 3000,
                investmentBase: 2,
            });

            const currentPrice = Price.from(2500);
            const result = service.calculateLevelsWithSizes(grid, currentPrice);

            const buyLevels = result.filter((l) => l.side === OrderSide.Buy);
            const sellLevels = result.filter((l) => l.side === OrderSide.Sell);

            expect(buyLevels.length).toBeGreaterThan(0);
            expect(sellLevels.length).toBeGreaterThan(0);
        });

        it('should handle all sell levels when price below lower bound', () => {
            const grid = makeGrid({
                symbol: 'SOL',
                lowerPrice: 100,
                upperPrice: 150,
                investmentBase: 50,
            });

            const currentPrice = Price.from(80);

            const result = service.calculateLevelsWithSizes(grid, currentPrice);

            const sellLevels = result.filter((l) => l.side === OrderSide.Sell);
            expect(sellLevels).toHaveLength(10);
        });

        it('should calculate correct amounts for buy orders', () => {
            const grid = makeGrid({
                lowerPrice: 45000,
                upperPrice: 50000,
                levels: 5,
            });

            const currentPrice = Price.from(55000); // All buys

            const result = service.calculateLevelsWithSizes(grid, currentPrice);

            result.forEach((level) => {
                expect(level.side).toBe(OrderSide.Buy);
                expect(level.amountUSDC).toBeDefined();
                expect(level.amountBase).toBeDefined();

                const expectedBase = level.amountUSDC! / level.price.toNumber();
                expect(level.amountBase).toBeCloseTo(expectedBase, 10);
            });
        });

        it('should calculate correct amounts for sell orders', () => {
            const grid = makeGrid({
                mode: GridMode.Long,
                lowerPrice: 50000,
                upperPrice: 55000,
                levels: 5,
                investmentUSDC: 3000,
            });

            const currentPrice = Price.from(45000); // All sells

            const result = service.calculateLevelsWithSizes(grid, currentPrice);

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
