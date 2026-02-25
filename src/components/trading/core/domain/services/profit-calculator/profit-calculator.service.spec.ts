import { beforeEach, describe, expect, it } from 'vitest';
import { ProfitCalculatorService } from './profit-calculator.service';
import { OrderDto } from '@/components/grids/api/dto/order.dto';
import { GridDto } from '@/components/grids/api/dto/grid.dto';
import { OrderSide } from '@domain/models/order/order-side';
import { OrderType } from '@domain/models/order/order-type';
import { OrderStatus } from '@domain/models/order/order-status';
import { GridMode } from '@domain/models/grid/grid-mode';
import { GridStatus } from '@domain/models/grid/grid-status';

describe('ProfitCalculatorService', () => {
    let service: ProfitCalculatorService;

    beforeEach(() => {
        service = new ProfitCalculatorService();
    });

    function createGrid(lowerPrice: number, upperPrice: number, levels: number): GridDto {
        return {
            id: '550e8400-e29b-41d4-a716-446655440000',
            symbol: 'BTC',
            mode: GridMode.Neutral,
            status: GridStatus.Running,
            lowerPrice,
            upperPrice,
            levels,
            investmentUSDC: 1000,
            investmentBase: 0.1,
            trailingEnabled: false,
            trailingTriggerPercent: 5,
            trailingStepPercent: 10,
            trailingPartialClosePercent: 50,
        };
    }

    function createOrder(side: OrderSide, amount: number): OrderDto {
        return {
            id: crypto.randomUUID(),
            gridId: '550e8400-e29b-41d4-a716-446655440000',
            symbol: 'BTC',
            type: OrderType.Limit,
            side,
            price: 50000,
            amount,
            status: OrderStatus.Filled,
            levelIndex: 1,
            exchangeOrderId: null,
        };
    }

    describe('calculate', () => {
        it('should return profit for SELL order', () => {
            const grid = createGrid(45000, 55000, 10);
            const order = createOrder(OrderSide.Sell, 0.01);

            const profit = service.calculate(order, grid);

            expect(profit).not.toBeNull();
            const spacing = (grid.upperPrice - grid.lowerPrice) / (grid.levels - 1);
            const expectedProfit = spacing * 0.01;
            expect(profit!.toNumber()).toBeCloseTo(expectedProfit, 6);
        });

        it('should return null for BUY order', () => {
            const grid = createGrid(45000, 55000, 10);
            const order = createOrder(OrderSide.Buy, 0.01);

            const profit = service.calculate(order, grid);

            expect(profit).toBeNull();
        });

        it('should calculate correct profit based on grid spacing and amount', () => {
            const grid = createGrid(40000, 50000, 11);
            const order = createOrder(OrderSide.Sell, 0.05);

            const profit = service.calculate(order, grid);

            expect(profit).not.toBeNull();
            const spacing = (50000 - 40000) / (11 - 1);
            const expectedProfit = spacing * 0.05;
            expect(profit!.toNumber()).toBeCloseTo(expectedProfit, 6);
        });
    });
});
