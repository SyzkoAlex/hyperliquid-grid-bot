import { beforeEach, describe, expect, it } from 'vitest';
import { ProfitCalculatorService } from './profit-calculator.service';

describe('ProfitCalculatorService', () => {
    let service: ProfitCalculatorService;

    beforeEach(() => {
        service = new ProfitCalculatorService();
    });

    describe('calculate', () => {
        it('should return profit based on grid spacing and amount', () => {
            const profit = service.calculate(0.01, 55000, 45000, 10);

            const spacing = (55000 - 45000) / (10 - 1);
            const expectedProfit = spacing * 0.01;
            expect(profit.toNumber()).toBeCloseTo(expectedProfit, 6);
        });

        it('should calculate correct profit for different grid parameters', () => {
            const profit = service.calculate(0.05, 50000, 40000, 11);

            const spacing = (50000 - 40000) / (11 - 1);
            const expectedProfit = spacing * 0.05;
            expect(profit.toNumber()).toBeCloseTo(expectedProfit, 6);
        });
    });
});
