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
            // maxFromBase >> 1760 (base not constraining)
            // → floored min = 1760
            const result = service.calculateMaxInvestment({
                usdcBalance: Decimal.from(800),
                baseBalance: Decimal.from(10),
                currentPrice: Price.from(100),
                lowerPrice: 80,
                upperPrice: 120,
                levels: 10,
                sellSizeBuffer: 0.005,
                szDecimals: 5,
            });
            expect(result).toBe(1760);
        });

        it('is constrained by base balance when base is the bottleneck', () => {
            // USDC=5000, base=100 HYPE @ $10, range $8-$12, 10 levels, szDecimals=5
            // buyCount=5, sellCount=6, totalLevels=11
            // maxBasePerLevel = floor(100/6, 5) = 16.66666
            // maxFromBase = 16.66666 * 10 * 11 / 1.005 = 1824.7 → floor = 1824
            const result = service.calculateMaxInvestment({
                usdcBalance: Decimal.from(5000),
                baseBalance: Decimal.from(100),
                currentPrice: Price.from(10),
                lowerPrice: 8,
                upperPrice: 12,
                levels: 10,
                sellSizeBuffer: 0.005,
                szDecimals: 5,
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
                szDecimals: 5,
            });
            expect(result).toBe(734);
        });

        it('reduces maxFromBase proportionally to sellSizeBuffer', () => {
            // With no buffer the max is 1833, with 0.5% buffer it shrinks
            const withBuffer = service.calculateMaxInvestment({
                usdcBalance: Decimal.from(5000),
                baseBalance: Decimal.from(100),
                currentPrice: Price.from(10),
                lowerPrice: 8,
                upperPrice: 12,
                levels: 10,
                sellSizeBuffer: 0.005,
                szDecimals: 5,
            });
            const withoutBuffer = service.calculateMaxInvestment({
                usdcBalance: Decimal.from(5000),
                baseBalance: Decimal.from(100),
                currentPrice: Price.from(10),
                lowerPrice: 8,
                upperPrice: 12,
                levels: 10,
                sellSizeBuffer: 0,
                szDecimals: 5,
            });
            expect(withBuffer).toBeLessThan(withoutBuffer);
            expect(withoutBuffer).toBe(1833);
        });

        it('returns Infinity-bounded result when grid is entirely below current price (sellCount = 0)', () => {
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
                szDecimals: 5,
            });
            expect(result).toBe(800);
        });

        it('returns Infinity-bounded result when grid is entirely above current price (buyRatio = 0)', () => {
            // All levels are sell orders → no buy orders needed → USDC balance is not a constraint
            // lowerPrice=110, upperPrice=120, currentPrice=100: all 11 level prices >= 100 → sellCount=11
            // maxBasePerLevel = floor(50/11, 5) = 4.54545
            // maxFromBase = 4.54545 * 100 * 11 / 1.005 = 4975.1 → floor = 4975
            const result = service.calculateMaxInvestment({
                usdcBalance: Decimal.from(0),
                baseBalance: Decimal.from(50),
                currentPrice: Price.from(100),
                lowerPrice: 110,
                upperPrice: 120,
                levels: 10,
                sellSizeBuffer: 0.005,
                szDecimals: 5,
            });
            expect(result).toBe(4975);
        });

        it('prevents overflow when per-level ceil rounding would push requiredBase above balance', () => {
            // base=10 units, price=10, range $8-$12, 10 levels → sellCount=6, totalLevels=11
            // szDecimals=1, sellSizeBuffer=0
            // algebraic upper bound (ignoring ceil-rounding): floor(10*10 / (6/11)) = 183
            // calculateDistribution(177): ceil(177*(6/11)/10/6, 1)*6 = ceil(1.609,1)*6 = 1.7*6 = 10.2 > 10 ✗
            // calculateDistribution(176): ceil(176*(6/11)/10/6, 1)*6 = ceil(1.6,1)*6 = 1.6*6 = 9.6 ≤ 10 ✓
            // walk-down finds 176 after ~7 iterations
            const result = service.calculateMaxInvestment({
                usdcBalance: Decimal.from(5000),
                baseBalance: Decimal.from(10),
                currentPrice: Price.from(10),
                lowerPrice: 8,
                upperPrice: 12,
                levels: 10,
                sellSizeBuffer: 0,
                szDecimals: 1,
            });
            expect(result).toBe(176);
        });

        it('result always satisfies both balance constraints when verified by calculateDistribution', () => {
            // Regression invariant: the value returned must never produce "Insufficient balance"
            const usdcBalance = Decimal.from(5697);
            const baseBalance = Decimal.from(22.48);
            const currentPrice = Price.from(60.77);
            const lowerPrice = 60.77 * 0.8;
            const upperPrice = 60.77 * 1.2;
            const sharedParams = {
                levels: 10,
                sellSizeBuffer: 0.005,
                szDecimals: 2,
            };

            const maxInvestment = service.calculateMaxInvestment({
                usdcBalance,
                baseBalance,
                currentPrice,
                lowerPrice,
                upperPrice,
                ...sharedParams,
            });

            const dist = service.calculateDistribution({
                totalInvestmentUSDC: maxInvestment,
                usdcBalance,
                baseBalance,
                currentPrice,
                lowerPrice,
                upperPrice,
                ...sharedParams,
            });

            expect(dist.requiredUSDC.lte(usdcBalance)).toBe(true);
            expect(dist.requiredBase.lte(baseBalance)).toBe(true);
        });

        it('returns 0 when both balances are zero', () => {
            const result = service.calculateMaxInvestment({
                usdcBalance: Decimal.from(0),
                baseBalance: Decimal.from(0),
                currentPrice: Price.from(100),
                lowerPrice: 80,
                upperPrice: 120,
                levels: 10,
                sellSizeBuffer: 0.005,
                szDecimals: 5,
            });
            expect(result).toBe(0);
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
                sellSizeBuffer: 0,
                szDecimals: 8,
            });

            // requiredUSDC = 10000 * 5/11 ~= 4545.45
            expect(result.requiredUSDC.toNumber()).toBeCloseTo(4545.45, 1);

            // rawInvestmentBase = 10000 * 6/11 / 50000 ~= 0.10909
            expect(result.rawInvestmentBase.toNumber()).toBeCloseTo(0.10909, 4);
            // requiredBase with sellSizeBuffer=0 and szDecimals=8 equals raw investmentBase
            expect(result.requiredBase.toNumber()).toBeCloseTo(0.10909, 4);
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
                sellSizeBuffer: 0,
                szDecimals: 8,
            };

            const result1 = service.calculateDistribution(params);
            const result2 = service.calculateDistribution(params);

            expect(result1.requiredUSDC.toNumber()).toBeCloseTo(
                result2.requiredUSDC.toNumber(),
                10,
            );
            expect(result1.requiredBase.toNumber()).toBeCloseTo(
                result2.requiredBase.toNumber(),
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
                sellSizeBuffer: 0,
                szDecimals: 8,
            });

            // Total portfolio = 10000, requiredUSDC = 10000 * 5/11 ~= 4545.45
            expect(result.requiredUSDC.toNumber()).toBeCloseTo(4545.45, 1);
            // requiredBase with sellSizeBuffer=0 and szDecimals=8 equals raw investmentBase ~= 0.10909
            expect(result.requiredBase.toNumber()).toBeCloseTo(0.10909, 4);
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
                sellSizeBuffer: 0,
                szDecimals: 8,
            });

            expect(result.requiredUSDC.toNumber()).toBeCloseTo(4545.45, 1);
            // requiredBase with sellSizeBuffer=0 and szDecimals=8 equals raw investmentBase ~= 0.10909
            expect(result.requiredBase.toNumber()).toBeCloseTo(0.10909, 4);
        });

        it('requiredBase equals rawInvestmentBase when sellSizeBuffer is zero (szDecimals=8)', () => {
            // With sellSizeBuffer=0 and szDecimals=8, ceil-rounding has no effect at this precision
            const result = service.calculateDistribution({
                levels: 10,
                totalInvestmentUSDC: 10000,
                usdcBalance: Decimal.from(10000),
                baseBalance: Decimal.from(1),
                currentPrice: Price.from(50000),
                lowerPrice: 45000,
                upperPrice: 55000,
                sellSizeBuffer: 0,
                szDecimals: 8,
            });

            const expectedRawBase = (10000 * (6 / 11)) / 50000;
            expect(result.rawInvestmentBase.toNumber()).toBeCloseTo(expectedRawBase, 7);
            expect(result.requiredBase.toNumber()).toBeCloseTo(expectedRawBase, 7);
        });

        it('requiredBase equals rawInvestmentBase * (1 + sellSizeBuffer) for szDecimals=8', () => {
            const buffer = 0.005;
            const result = service.calculateDistribution({
                levels: 10,
                totalInvestmentUSDC: 10000,
                usdcBalance: Decimal.from(10000),
                baseBalance: Decimal.from(1),
                currentPrice: Price.from(50000),
                lowerPrice: 45000,
                upperPrice: 55000,
                sellSizeBuffer: buffer,
                szDecimals: 8,
            });

            // requiredBase is derived from rawInvestmentBase — verify the relationship directly
            expect(result.requiredBase.toNumber()).toBeCloseTo(
                result.rawInvestmentBase.toNumber() * (1 + buffer),
                7,
            );
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
                sellSizeBuffer: 0,
                szDecimals: 8,
            });

            // requiredUSDC = 103 * 4/11 ~= 37.45
            const expectedUSDC = investment * (4 / 11);
            expect(result.requiredUSDC.toNumber()).toBeCloseTo(expectedUSDC, 4);

            // requiredBase with sellSizeBuffer=0 and szDecimals=8 equals raw investmentBase
            // investmentBase = 103 * 7/11 / 84.57
            const expectedBase = (investment * (7 / 11)) / currentPrice;
            expect(result.requiredBase.toNumber()).toBeCloseTo(expectedBase, 6);

            // Verify equal per-order notional: both buy and sell notional per order ~= 103/11
            const perOrder = investment / 11;
            const buyNotionalPerOrder = result.requiredUSDC.toNumber() / 4;
            const sellNotionalPerOrder = (result.requiredBase.toNumber() * currentPrice) / 7;
            expect(buyNotionalPerOrder).toBeCloseTo(perOrder, 4);
            expect(sellNotionalPerOrder).toBeCloseTo(perOrder, 4);
        });

        it('mirrors exchange ceil-rounding per sell level (regression: szDecimals=5, HYPE-like)', () => {
            // HYPE token: szDecimals=5, price=$10, range $8-$12, 10 levels
            // buyCount=5, sellCount=6, totalLevels=11
            // investmentBase = 100 * (6/11) / 10 = 5.45454545...
            // basePerSellLevel = 5.45454.../6 = 0.90909090...
            // ceil(0.90909090..., 5) = ceil(90909.09...) / 100000 = 90910 / 100000 = 0.9091
            // requiredBase = 0.9091 * 6 = 5.4546
            const result = service.calculateDistribution({
                levels: 10,
                totalInvestmentUSDC: 100,
                usdcBalance: Decimal.from(100),
                baseBalance: Decimal.from(10),
                currentPrice: Price.from(10),
                lowerPrice: 8,
                upperPrice: 12,
                sellSizeBuffer: 0,
                szDecimals: 5,
            });

            expect(result.requiredBase.toNumber()).toBeCloseTo(5.4546, 4);
            expect(result.requiredBase.toNumber()).toBeGreaterThan(
                // raw investmentBase = 100 * (6/11) / 10 = 5.45454...
                (100 * (6 / 11)) / 10,
            );
        });

        it('overshoots rawInvestmentBase by exchange ceil rounding for low szDecimals (regression: HYPE mainnet)', () => {
            // HYPE mainnet: szDecimals = 2. Investment scenario from the original bug report:
            // capital ≈ 3050 USDC, range 67-82, currentPrice = 74.49, levels = 10
            // → buyCount = 5, sellCount = 6, totalLevels = 11
            // rawInvestmentBase = 3050 * 6/11 / 74.49 ≈ 22.3337 HYPE
            // per-sell raw = 22.3337/6 * 1.005 ≈ 3.7409 → ceil(., 2) = 3.75 → requiredBase = 22.50
            const result = service.calculateDistribution({
                levels: 10,
                totalInvestmentUSDC: 3050,
                usdcBalance: Decimal.from(3050),
                baseBalance: Decimal.from(100),
                currentPrice: Price.from(74.49),
                lowerPrice: 67,
                upperPrice: 82,
                sellSizeBuffer: 0.005,
                szDecimals: 2,
            });

            expect(result.rawInvestmentBase.toNumber()).toBeCloseTo(22.3337, 3);
            expect(result.requiredBase.toNumber()).toBeCloseTo(22.5, 6);
            expect(result.requiredBase.toNumber()).toBeGreaterThan(
                result.rawInvestmentBase.toNumber(),
            );
        });

        it('returns requiredBase=0 when all levels are below current price (sellCount=0)', () => {
            // lowerPrice=80, upperPrice=90, currentPrice=100: all 11 level prices < 100 → sellCount=0
            // No sell orders → no base required; all capital goes to buy orders
            const result = service.calculateDistribution({
                levels: 10,
                totalInvestmentUSDC: 1000,
                usdcBalance: Decimal.from(1000),
                baseBalance: Decimal.from(0),
                currentPrice: Price.from(100),
                lowerPrice: 80,
                upperPrice: 90,
                sellSizeBuffer: 0.005,
                szDecimals: 5,
            });
            expect(result.requiredBase.toNumber()).toBe(0);
            expect(result.rawInvestmentBase.toNumber()).toBe(0);
            expect(result.requiredUSDC.toNumber()).toBeCloseTo(1000, 6);
        });
    });
});
