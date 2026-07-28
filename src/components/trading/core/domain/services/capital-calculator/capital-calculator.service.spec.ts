import { beforeEach, describe, expect, it } from 'vitest';
import { CapitalCalculatorService } from './capital-calculator.service';
import { Decimal } from '@domain/models/primitives/decimal';
import { Price } from '@domain/models/primitives/price';
import { SwapSide } from '@components/trading/core/domain/models/swap/swap-side';

describe('CapitalCalculatorService', () => {
    let service: CapitalCalculatorService;

    beforeEach(() => {
        service = new CapitalCalculatorService();
    });

    describe('calculateMaxInvestment', () => {
        it('is constrained by USDC balance when USDC is the bottleneck', () => {
            // USDC=800, base=10 SOL @ $100, range $80-$120, 10 orders
            // buyCount=5, sellCount=5, totalOrders=10
            // maxFromUsdc = 800 / (5/10) = 1600
            // maxFromBase >> 1600 (base not constraining)
            // → floored min = 1600
            const result = service.calculateMaxInvestment({
                usdcBalance: Decimal.from(800),
                baseBalance: Decimal.from(10),
                currentPrice: Price.from(100),
                lowerPrice: 80,
                upperPrice: 120,
                orderCount: 10,
                sellSizeBuffer: 0.005,
                szDecimals: 5,
            });
            expect(result).toBe(1600);
        });

        it('is constrained by base balance when base is the bottleneck', () => {
            // USDC=5000, base=100 HYPE @ $10, range $8-$12, 10 orders, szDecimals=5
            // buyCount=5, sellCount=5, totalOrders=10
            // maxBasePerOrder = floor(100/5, 5) = 20
            // maxFromBase = 20 * 10 * 10 / 1.005 = 1990.05 → floor = 1990
            const result = service.calculateMaxInvestment({
                usdcBalance: Decimal.from(5000),
                baseBalance: Decimal.from(100),
                currentPrice: Price.from(10),
                lowerPrice: 8,
                upperPrice: 12,
                orderCount: 10,
                sellSizeBuffer: 0.005,
                szDecimals: 5,
            });
            expect(result).toBe(1990);
        });

        it('floors the result to a whole number', () => {
            // ETH=1 @ $3000, USDC=333.7, range $2700-$3300, 10 orders
            // buyCount=5, sellCount=5, totalOrders=10
            // maxFromUsdc = 333.7 / (5/10) = 667.4 → floor = 667
            const result = service.calculateMaxInvestment({
                usdcBalance: Decimal.from(333.7),
                baseBalance: Decimal.from(1),
                currentPrice: Price.from(3000),
                lowerPrice: 2700,
                upperPrice: 3300,
                orderCount: 10,
                sellSizeBuffer: 0.005,
                szDecimals: 5,
            });
            expect(result).toBe(667);
        });

        it('reduces maxFromBase proportionally to sellSizeBuffer', () => {
            // With no buffer the max is 2000, with 0.5% buffer it shrinks
            const withBuffer = service.calculateMaxInvestment({
                usdcBalance: Decimal.from(5000),
                baseBalance: Decimal.from(100),
                currentPrice: Price.from(10),
                lowerPrice: 8,
                upperPrice: 12,
                orderCount: 10,
                sellSizeBuffer: 0.005,
                szDecimals: 5,
            });
            const withoutBuffer = service.calculateMaxInvestment({
                usdcBalance: Decimal.from(5000),
                baseBalance: Decimal.from(100),
                currentPrice: Price.from(10),
                lowerPrice: 8,
                upperPrice: 12,
                orderCount: 10,
                sellSizeBuffer: 0,
                szDecimals: 5,
            });
            expect(withBuffer).toBeLessThan(withoutBuffer);
            expect(withoutBuffer).toBe(2000);
        });

        it('returns Infinity-bounded result when grid is entirely below current price (sellCount = 0)', () => {
            // All orders are buy orders → no sell orders needed → base balance is not a constraint
            // lowerPrice=80, upperPrice=90, currentPrice=100: all 10 order prices < 100 → sellCount=0
            // maxFromBase = Infinity, maxFromUsdc = 800 / (10/10) = 800
            const result = service.calculateMaxInvestment({
                usdcBalance: Decimal.from(800),
                baseBalance: Decimal.from(0),
                currentPrice: Price.from(100),
                lowerPrice: 80,
                upperPrice: 90,
                orderCount: 10,
                sellSizeBuffer: 0.005,
                szDecimals: 5,
            });
            expect(result).toBe(800);
        });

        it('returns Infinity-bounded result when grid is entirely above current price (buyRatio = 0)', () => {
            // All orders are sell orders → no buy orders needed → USDC balance is not a constraint
            // lowerPrice=110, upperPrice=120, currentPrice=100: all 10 order prices >= 100 → sellCount=10
            // maxBasePerOrder = floor(50/10, 5) = 5
            // maxFromBase = 5 * 100 * 10 / 1.005 = 4975.1... → floor = 4975
            const result = service.calculateMaxInvestment({
                usdcBalance: Decimal.from(0),
                baseBalance: Decimal.from(50),
                currentPrice: Price.from(100),
                lowerPrice: 110,
                upperPrice: 120,
                orderCount: 10,
                sellSizeBuffer: 0.005,
                szDecimals: 5,
            });
            expect(result).toBe(4975);
        });

        it('prevents overflow when per-order ceil rounding would push requiredBase above balance', () => {
            // base=10 units, price=10, range $8-$12, 10 orders → sellCount=5, totalOrders=10
            // szDecimals=1, sellSizeBuffer=0
            const result = service.calculateMaxInvestment({
                usdcBalance: Decimal.from(5000),
                baseBalance: Decimal.from(10),
                currentPrice: Price.from(10),
                lowerPrice: 8,
                upperPrice: 12,
                orderCount: 10,
                sellSizeBuffer: 0,
                szDecimals: 1,
            });
            expect(result).toBe(200);
        });

        it('result always satisfies both balance constraints when verified by calculateDistribution', () => {
            // Regression invariant: the value returned must never produce "Insufficient balance"
            const usdcBalance = Decimal.from(5697);
            const baseBalance = Decimal.from(22.48);
            const currentPrice = Price.from(60.77);
            const lowerPrice = 60.77 * 0.8;
            const upperPrice = 60.77 * 1.2;
            const sharedParams = {
                orderCount: 10,
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
                orderCount: 10,
                sellSizeBuffer: 0.005,
                szDecimals: 5,
            });
            expect(result).toBe(0);
        });
    });

    describe('calculateOptimalSwap', () => {
        // Grid: price=$10, range=$8-$12, 10 orders
        // buyCount=5, sellCount=5, totalOrders=10
        // buyRatio=5/10, sellRatio=5/10
        const baseParams = {
            currentPrice: Price.from(10),
            lowerPrice: 8,
            upperPrice: 12,
            orderCount: 10,
        };

        it('returns UsdcToBase when USDC balance is heavier than optimal', () => {
            // totalValueUsdc = 7300 + 0*10 = 7300
            // optimalUsdc = 7300 * 5/10 = 3650
            // diff = 7300 - 3650 = 3650 → swap USDC to base
            const result = service.calculateOptimalSwap({
                ...baseParams,
                usdcBalance: Decimal.from(7300),
                baseBalance: Decimal.from(0),
            });

            expect(result).not.toBeNull();
            expect(result!.side).toBe(SwapSide.UsdcToBase);
            expect(result!.amountUsdc).toBeCloseTo(7300 - 7300 * (5 / 10), 4);
            expect(result!.expectedReceived).toBeCloseTo(result!.amountUsdc / 10, 6);
        });

        it('returns BaseToUsdc when base balance is heavier than optimal', () => {
            // totalValueUsdc = 0 + 1*10 = 10 (all in base)
            // optimalUsdc = 10 * 5/10 = 5
            // diff = 0 - 5 = -5 → swap base to USDC
            const result = service.calculateOptimalSwap({
                ...baseParams,
                usdcBalance: Decimal.from(0),
                baseBalance: Decimal.from(1),
            });

            expect(result).not.toBeNull();
            expect(result!.side).toBe(SwapSide.BaseToUsdc);
            expect(result!.amountUsdc).toBeCloseTo(10 * (5 / 10), 4);
            expect(result!.expectedReceived).toBeCloseTo(10 * (5 / 10), 4);
        });

        it('returns null when portfolio is balanced within $1 dead-band', () => {
            // totalValueUsdc = 5 + 0.6*10 = 11
            // optimalUsdc = 11 * 5/10 = 5.5
            // diff = 5 - 5.5 = -0.5 → within dead-band
            const result = service.calculateOptimalSwap({
                ...baseParams,
                usdcBalance: Decimal.from(5),
                baseBalance: Decimal.from(0.6),
            });

            expect(result).toBeNull();
        });

        it('returns null when sellCount is 0 (all-buy grid)', () => {
            // lowerPrice=80, upperPrice=90, currentPrice=100: all orders < 100 → sellCount=0
            const result = service.calculateOptimalSwap({
                usdcBalance: Decimal.from(1000),
                baseBalance: Decimal.from(10),
                currentPrice: Price.from(100),
                lowerPrice: 80,
                upperPrice: 90,
                orderCount: 10,
            });

            expect(result).toBeNull();
        });

        it('returns null when buyCount is 0 (all-sell grid)', () => {
            // lowerPrice=110, upperPrice=120, currentPrice=100: all orders >= 100 → buyCount=0
            const result = service.calculateOptimalSwap({
                usdcBalance: Decimal.from(0),
                baseBalance: Decimal.from(10),
                currentPrice: Price.from(100),
                lowerPrice: 110,
                upperPrice: 120,
                orderCount: 10,
            });

            expect(result).toBeNull();
        });
    });

    describe('calculateDistribution', () => {
        it('should calculate geometry-based distribution for symmetric range', () => {
            // priceStep = 1111.11, orderPrices: 45k,46.11k,...,55k (10 total)
            // buyCount = 5 (< 50000), sellCount = 5 (>= 50000)
            const result = service.calculateDistribution({
                orderCount: 10,
                totalInvestmentUSDC: 10000,
                usdcBalance: Decimal.from(10000),
                baseBalance: Decimal.from(1),
                currentPrice: Price.from(50000),
                lowerPrice: 45000,
                upperPrice: 55000,
                sellSizeBuffer: 0,
                szDecimals: 8,
            });

            // requiredUSDC = 10000 * 5/10 = 5000
            expect(result.requiredUSDC.toNumber()).toBeCloseTo(5000, 1);

            // rawInvestmentBase = 10000 * 5/10 / 50000 = 0.1
            expect(result.rawInvestmentBase.toNumber()).toBeCloseTo(0.1, 4);
            // requiredBase with sellSizeBuffer=0 and szDecimals=8 equals raw investmentBase
            expect(result.requiredBase.toNumber()).toBeCloseTo(0.1, 4);
        });

        it('should produce consistent results for the same parameters', () => {
            const params = {
                orderCount: 10,
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
            // buyCount = 5, sellCount = 5 for range 45k-55k at 50k price, 10 orders
            const result = service.calculateDistribution({
                orderCount: 10,
                usdcBalance: Decimal.from(5000),
                baseBalance: Decimal.from(0.1), // 0.1 BTC at $50,000 = $5,000
                currentPrice: Price.from(50000),
                lowerPrice: 45000,
                upperPrice: 55000,
                sellSizeBuffer: 0,
                szDecimals: 8,
            });

            // Total portfolio = 10000, requiredUSDC = 10000 * 5/10 = 5000
            expect(result.requiredUSDC.toNumber()).toBeCloseTo(5000, 1);
            // requiredBase with sellSizeBuffer=0 and szDecimals=8 equals raw investmentBase = 0.1
            expect(result.requiredBase.toNumber()).toBeCloseTo(0.1, 4);
        });

        it('should calculate distribution even with insufficient balance', () => {
            const result = service.calculateDistribution({
                orderCount: 10,
                totalInvestmentUSDC: 10000,
                usdcBalance: Decimal.from(3000),
                baseBalance: Decimal.from(0.05),
                currentPrice: Price.from(50000),
                lowerPrice: 45000,
                upperPrice: 55000,
                sellSizeBuffer: 0,
                szDecimals: 8,
            });

            expect(result.requiredUSDC.toNumber()).toBeCloseTo(5000, 1);
            // requiredBase with sellSizeBuffer=0 and szDecimals=8 equals raw investmentBase = 0.1
            expect(result.requiredBase.toNumber()).toBeCloseTo(0.1, 4);
        });

        it('requiredBase equals rawInvestmentBase when sellSizeBuffer is zero (szDecimals=8)', () => {
            // With sellSizeBuffer=0 and szDecimals=8, ceil-rounding has no effect at this precision
            const result = service.calculateDistribution({
                orderCount: 10,
                totalInvestmentUSDC: 10000,
                usdcBalance: Decimal.from(10000),
                baseBalance: Decimal.from(1),
                currentPrice: Price.from(50000),
                lowerPrice: 45000,
                upperPrice: 55000,
                sellSizeBuffer: 0,
                szDecimals: 8,
            });

            const expectedRawBase = (10000 * (5 / 10)) / 50000;
            expect(result.rawInvestmentBase.toNumber()).toBeCloseTo(expectedRawBase, 7);
            expect(result.requiredBase.toNumber()).toBeCloseTo(expectedRawBase, 7);
        });

        it('requiredBase equals rawInvestmentBase * (1 + sellSizeBuffer) for szDecimals=8', () => {
            const buffer = 0.005;
            const result = service.calculateDistribution({
                orderCount: 10,
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
            // USOL, price $84.57, range $75-$100, 10 orders
            // priceStep = 25/9 ~= 2.778, orderPrices: 75,77.78,80.56,83.33,86.11,...,100
            // buyCount = 4 (< 84.57), sellCount = 6 (>= 84.57)
            const investment = 103;
            const currentPrice = 84.57;

            const result = service.calculateDistribution({
                orderCount: 10,
                totalInvestmentUSDC: investment,
                usdcBalance: Decimal.from(500),
                baseBalance: Decimal.from(10),
                currentPrice: Price.from(currentPrice),
                lowerPrice: 75,
                upperPrice: 100,
                sellSizeBuffer: 0,
                szDecimals: 8,
            });

            // requiredUSDC = 103 * 4/10 = 41.2
            const expectedUSDC = investment * (4 / 10);
            expect(result.requiredUSDC.toNumber()).toBeCloseTo(expectedUSDC, 4);

            // requiredBase with sellSizeBuffer=0 and szDecimals=8 equals raw investmentBase
            // investmentBase = 103 * 6/10 / 84.57
            const expectedBase = (investment * (6 / 10)) / currentPrice;
            expect(result.requiredBase.toNumber()).toBeCloseTo(expectedBase, 6);

            // Verify equal per-order notional: both buy and sell notional per order ~= 103/10
            const perOrder = investment / 10;
            const buyNotionalPerOrder = result.requiredUSDC.toNumber() / 4;
            const sellNotionalPerOrder = (result.requiredBase.toNumber() * currentPrice) / 6;
            expect(buyNotionalPerOrder).toBeCloseTo(perOrder, 4);
            expect(sellNotionalPerOrder).toBeCloseTo(perOrder, 4);
        });

        it('mirrors exchange ceil-rounding per sell order (regression: szDecimals=5, HYPE-like)', () => {
            // HYPE token: szDecimals=5, price=$10, range $8-$12, 10 orders
            // buyCount=5, sellCount=5, totalOrders=10
            // investmentBase = 100 * (5/10) / 10 = 5
            // basePerSellOrder = 5/5 = 1 → ceil(1, 5) = 1
            // requiredBase = 1 * 5 = 5
            const result = service.calculateDistribution({
                orderCount: 10,
                totalInvestmentUSDC: 100,
                usdcBalance: Decimal.from(100),
                baseBalance: Decimal.from(10),
                currentPrice: Price.from(10),
                lowerPrice: 8,
                upperPrice: 12,
                sellSizeBuffer: 0,
                szDecimals: 5,
            });

            expect(result.requiredBase.toNumber()).toBeCloseTo(5, 4);
            expect(result.requiredBase.toNumber()).toBeGreaterThanOrEqual(
                // raw investmentBase = 100 * (5/10) / 10 = 5
                (100 * (5 / 10)) / 10,
            );
        });

        it('overshoots rawInvestmentBase by exchange ceil rounding for low szDecimals (regression: HYPE mainnet)', () => {
            // HYPE mainnet: szDecimals = 2. Investment scenario from the original bug report:
            // capital ≈ 3050 USDC, range 67-82, currentPrice = 74.49, orderCount = 10
            // → buyCount = 5, sellCount = 5, totalOrders = 10
            // rawInvestmentBase = 3050 * 5/10 / 74.49 ≈ 20.4725 HYPE
            // per-sell raw = 20.4725/5 * 1.005 ≈ 4.115 → ceil(., 2) = 4.12 → requiredBase = 20.60
            const result = service.calculateDistribution({
                orderCount: 10,
                totalInvestmentUSDC: 3050,
                usdcBalance: Decimal.from(3050),
                baseBalance: Decimal.from(100),
                currentPrice: Price.from(74.49),
                lowerPrice: 67,
                upperPrice: 82,
                sellSizeBuffer: 0.005,
                szDecimals: 2,
            });

            expect(result.rawInvestmentBase.toNumber()).toBeCloseTo(20.4725, 3);
            expect(result.requiredBase.toNumber()).toBeCloseTo(20.6, 6);
            expect(result.requiredBase.toNumber()).toBeGreaterThan(
                result.rawInvestmentBase.toNumber(),
            );
        });

        it('returns requiredBase=0 when all orders are below current price (sellCount=0)', () => {
            // lowerPrice=80, upperPrice=90, currentPrice=100: all 10 order prices < 100 → sellCount=0
            // No sell orders → no base required; all capital goes to buy orders
            const result = service.calculateDistribution({
                orderCount: 10,
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
