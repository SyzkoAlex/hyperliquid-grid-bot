import { beforeEach, describe, expect, it } from 'vitest';
import { CapitalCalculatorService } from './capital-calculator.service';
import { Decimal } from '@domain/models/primitives/decimal';
import { Price } from '@domain/models/primitives/price';

describe('CapitalCalculatorService', () => {
    let service: CapitalCalculatorService;

    beforeEach(() => {
        service = new CapitalCalculatorService();
    });

    describe('calculateMaxInvestment', () => {
        it('is constrained by USDC balance when USDC is the bottleneck', () => {
            // USDC=800, base=10 SOL @ $100, range $80-$120, 10 levels
            // buyCount=5, sellCount=6, totalLevels=11
            // maxFromUsdc = 800 / (5/11) = 1760
            // maxFromBase = 1000 / (6/11 * 1.005) = 1824.5
            // → floored min = 1760
            const result = service.calculateMaxInvestment({
                usdcBalance: Decimal.from(800),
                baseBalance: Decimal.from(10),
                currentPrice: Price.from(100),
                lowerPrice: 80,
                upperPrice: 120,
                levels: 10,
                sellSizeBuffer: 0.005,
            });
            expect(result).toBe(1760);
        });

        it('is constrained by base balance when base is the bottleneck', () => {
            // USDC=5000, base=100 HYPE @ $10, range $8-$12, 10 levels
            // buyCount=5, sellCount=6, totalLevels=11
            // maxFromUsdc = 5000 / (5/11) = 11000
            // maxFromBase = 1000 / (6/11 * 1.005) = floor(1824.5) = 1824
            const result = service.calculateMaxInvestment({
                usdcBalance: Decimal.from(5000),
                baseBalance: Decimal.from(100),
                currentPrice: Price.from(10),
                lowerPrice: 8,
                upperPrice: 12,
                levels: 10,
                sellSizeBuffer: 0.005,
            });
            expect(result).toBe(1824);
        });

        it('floors the result to a whole number', () => {
            // ETH=1 @ $3000, USDC=333.7, range $2700-$3300, 10 levels
            // buyCount=5, sellCount=6, totalLevels=11
            // maxFromUsdc = 333.7 / (5/11) = 734.14 → floor = 734
            const result = service.calculateMaxInvestment({
                usdcBalance: Decimal.from(333.7),
                baseBalance: Decimal.from(1),
                currentPrice: Price.from(3000),
                lowerPrice: 2700,
                upperPrice: 3300,
                levels: 10,
                sellSizeBuffer: 0.005,
            });
            expect(result).toBe(734);
        });

        it('reduces maxFromBase proportionally to sellSizeBuffer', () => {
            // With no buffer the max is 1833 (original logic), with 0.5% buffer it shrinks
            const withBuffer = service.calculateMaxInvestment({
                usdcBalance: Decimal.from(5000),
                baseBalance: Decimal.from(100),
                currentPrice: Price.from(10),
                lowerPrice: 8,
                upperPrice: 12,
                levels: 10,
                sellSizeBuffer: 0.005,
            });
            const withoutBuffer = service.calculateMaxInvestment({
                usdcBalance: Decimal.from(5000),
                baseBalance: Decimal.from(100),
                currentPrice: Price.from(10),
                lowerPrice: 8,
                upperPrice: 12,
                levels: 10,
                sellSizeBuffer: 0,
            });
            expect(withBuffer).toBeLessThan(withoutBuffer);
            expect(withoutBuffer).toBe(1833);
        });

        it('returns Infinity-bounded result when grid is entirely below current price (sellRatio = 0)', () => {
            // All levels are buy orders → no sell orders needed → base balance is not a constraint
            // lowerPrice=80, upperPrice=90, currentPrice=100: all 11 level prices < 100 → sellCount=0
            // maxFromBase = Infinity, maxFromUsdc = 800 / (11/11) = 800
            const result = service.calculateMaxInvestment({
                usdcBalance: Decimal.from(800),
                baseBalance: Decimal.from(0),
                currentPrice: Price.from(100),
                lowerPrice: 80,
                upperPrice: 90,
                levels: 10,
                sellSizeBuffer: 0.005,
            });
            expect(result).toBe(800);
        });

        it('returns Infinity-bounded result when grid is entirely above current price (buyRatio = 0)', () => {
            // All levels are sell orders → no buy orders needed → USDC balance is not a constraint
            // lowerPrice=110, upperPrice=120, currentPrice=100: all 11 level prices >= 100 → buyCount=0
            // maxFromUsdc = Infinity, maxFromBase = (50 * 100) / (11/11 * 1.005) = 5000 / 1.005 ≈ 4975.1 → floor = 4975
            const result = service.calculateMaxInvestment({
                usdcBalance: Decimal.from(0),
                baseBalance: Decimal.from(50),
                currentPrice: Price.from(100),
                lowerPrice: 110,
                upperPrice: 120,
                levels: 10,
                sellSizeBuffer: 0.005,
            });
            expect(result).toBe(4975);
        });
    });

    describe('calculateDistribution', () => {
        it('should calculate geometry-based distribution for symmetric range', () => {
            // priceStep = 1000, levelPrices: 45k,46k,47k,48k,49k,50k,51k,52k,53k,54k,55k (11 total)
            // buyCount = 5 (45k,46k,47k,48k,49k < 50000)
            // sellCount = 6 (50k,51k,52k,53k,54k,55k >= 50000)
            const result = service.calculateDistribution({
                levels: 10,
                totalInvestmentUSDC: 10000,
                usdcBalance: Decimal.from(10000),
                baseBalance: Decimal.from(1),
                currentPrice: Price.from(50000),
                lowerPrice: 45000,
                upperPrice: 55000,
            });

            // investmentUSDC = 10000 * 5/11 ~= 4545.45
            expect(result.investmentUSDC.toNumber()).toBeCloseTo(4545.45, 1);

            // investmentBase = 10000 * 6/11 / 50000 ~= 0.10909
            expect(result.investmentBase.toNumber()).toBeCloseTo(0.10909, 4);
        });

        it('should produce consistent results for the same parameters', () => {
            const params = {
                levels: 10,
                totalInvestmentUSDC: 10000,
                usdcBalance: Decimal.from(10000),
                baseBalance: Decimal.from(1),
                currentPrice: Price.from(50000),
                lowerPrice: 45000,
                upperPrice: 55000,
            };

            const result1 = service.calculateDistribution(params);
            const result2 = service.calculateDistribution(params);

            expect(result1.investmentUSDC.toNumber()).toBeCloseTo(
                result2.investmentUSDC.toNumber(),
                10,
            );
            expect(result1.investmentBase.toNumber()).toBeCloseTo(
                result2.investmentBase.toNumber(),
                10,
            );
        });

        it('should auto-calculate capital from balance when not provided', () => {
            // Total value: 5,000 USDC + (0.1 BTC * 50,000) = 10,000 USDC
            // priceStep = 1000, buyCount = 5, sellCount = 6 for range 45k-55k at 50k price
            const result = service.calculateDistribution({
                levels: 10,
                usdcBalance: Decimal.from(5000),
                baseBalance: Decimal.from(0.1), // 0.1 BTC at $50,000 = $5,000
                currentPrice: Price.from(50000),
                lowerPrice: 45000,
                upperPrice: 55000,
            });

            // Total portfolio = 10000, investmentUSDC = 10000 * 5/11 ~= 4545.45
            expect(result.investmentUSDC.toNumber()).toBeCloseTo(4545.45, 1);
            expect(result.investmentBase.toNumber()).toBeCloseTo(0.10909, 4);
        });

        it('should calculate distribution even with insufficient balance', () => {
            const result = service.calculateDistribution({
                levels: 10,
                totalInvestmentUSDC: 10000,
                usdcBalance: Decimal.from(3000),
                baseBalance: Decimal.from(0.05),
                currentPrice: Price.from(50000),
                lowerPrice: 45000,
                upperPrice: 55000,
            });

            expect(result.investmentUSDC.toNumber()).toBeCloseTo(4545.45, 1);
            expect(result.investmentBase.toNumber()).toBeCloseTo(0.10909, 4);
        });

        it('should produce equal per-order USDC notional -- research example (USOL)', () => {
            // USOL, price $84.57, range $75-$100, 10 levels
            // priceStep = 2.5, levelPrices: 75,77.5,80,82.5,85,87.5,90,92.5,95,97.5,100
            // buyCount = 4 (75,77.5,80,82.5 < 84.57), sellCount = 7 (85,...,100 >= 84.57)
            // totalLevels = 11, perOrder = 103/11 ~= 9.36
            const investment = 103;
            const currentPrice = 84.57;

            const result = service.calculateDistribution({
                levels: 10,
                totalInvestmentUSDC: investment,
                usdcBalance: Decimal.from(500),
                baseBalance: Decimal.from(10),
                currentPrice: Price.from(currentPrice),
                lowerPrice: 75,
                upperPrice: 100,
            });

            // investmentUSDC = 103 * 4/11 ~= 37.45
            const expectedUSDC = investment * (4 / 11);
            expect(result.investmentUSDC.toNumber()).toBeCloseTo(expectedUSDC, 4);

            // investmentBase = 103 * 7/11 / 84.57
            const expectedBase = (investment * (7 / 11)) / currentPrice;
            expect(result.investmentBase.toNumber()).toBeCloseTo(expectedBase, 6);

            // Verify equal per-order notional: both buy and sell notional per order ~= 103/11
            const perOrder = investment / 11;
            const buyNotionalPerOrder = result.investmentUSDC.toNumber() / 4;
            const sellNotionalPerOrder = (result.investmentBase.toNumber() * currentPrice) / 7;
            expect(buyNotionalPerOrder).toBeCloseTo(perOrder, 4);
            expect(sellNotionalPerOrder).toBeCloseTo(perOrder, 4);
        });
    });
});
