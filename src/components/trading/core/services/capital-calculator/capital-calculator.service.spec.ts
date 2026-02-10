import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { CapitalCalculatorService } from './capital-calculator.service';
import { Decimal } from '../../../../../domain/primitives/decimal';
import { GridMode } from '@domain/grid/grid-mode';
import { Price } from '@domain/primitives/price';

describe('CapitalCalculatorService', () => {
    let service: CapitalCalculatorService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [CapitalCalculatorService],
        }).compile();

        service = module.get<CapitalCalculatorService>(CapitalCalculatorService);
    });

    describe('calculateDistribution', () => {
        it('should calculate neutral mode with 50/50 split', () => {
            const result = service.calculateDistribution({
                mode: GridMode.Neutral,
                totalInvestmentUSDC: 10000,
                usdcBalance: Decimal.from(10000),
                baseBalance: Decimal.from(1),
                currentPrice: Price.from(50000),
                lowerPrice: 45000,
                upperPrice: 55000,
            });

            // 50% of $10,000 = $5,000 for buys
            expect(result.investmentUSDC.toNumber()).toBe(5000);

            // 50% of $10,000 = $5,000 / $50,000 (current price) = 0.1 BTC
            expect(result.investmentBase.toNumber()).toBeCloseTo(0.1, 5);
        });

        it('should calculate long mode with 30/70 split', () => {
            const result = service.calculateDistribution({
                mode: GridMode.Long,
                totalInvestmentUSDC: 10000,
                usdcBalance: Decimal.from(10000),
                baseBalance: Decimal.from(1),
                currentPrice: Price.from(50000),
                lowerPrice: 45000,
                upperPrice: 55000,
            });

            // 30% of $10,000 = $3,000 for buys
            expect(result.investmentUSDC.toNumber()).toBe(3000);

            // 70% of $10,000 = $7,000 / $50,000 (current price) = 0.14 BTC
            expect(result.investmentBase.toNumber()).toBeCloseTo(0.14, 5);
        });

        it('should auto-calculate capital from balance when not provided', () => {
            const result = service.calculateDistribution({
                mode: GridMode.Neutral,
                usdcBalance: Decimal.from(5000),
                baseBalance: Decimal.from(0.1), // 0.1 BTC at $50,000 = $5,000
                currentPrice: Price.from(50000),
                lowerPrice: 45000,
                upperPrice: 55000,
            });

            // Total value: $5,000 + ($5,000 from 0.1 BTC) = $10,000
            // 50% of $10,000 = $5,000
            expect(result.investmentUSDC.toNumber()).toBe(5000);
            expect(result.investmentBase.toNumber()).toBeCloseTo(0.1, 5);
        });

        it('should adjust for insufficient base balance', () => {
            const result = service.calculateDistribution({
                mode: GridMode.Neutral,
                totalInvestmentUSDC: 10000,
                usdcBalance: Decimal.from(10000),
                baseBalance: Decimal.from(0.05), // Only 0.05 BTC available, needs 0.1
                currentPrice: Price.from(50000),
                lowerPrice: 45000,
                upperPrice: 55000,
            });

            // USDC investment unchanged
            expect(result.investmentUSDC.toNumber()).toBe(5000);

            // Base investment limited to available balance
            expect(result.investmentBase.toNumber()).toBe(0.05);
        });

        it('should throw error for invalid mode', () => {
            expect(() => {
                service.calculateDistribution({
                    mode: 'invalid' as GridMode,
                    totalInvestmentUSDC: 10000,
                    usdcBalance: Decimal.from(10000),
                    baseBalance: Decimal.from(1),
                    currentPrice: Price.from(50000),
                    lowerPrice: 45000,
                    upperPrice: 55000,
                });
            }).toThrow('Invalid mode: invalid');
        });
    });
});
