import { beforeEach, describe, expect, it } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ProfitCalculatorService } from './profit-calculator.service';
import { Order } from '@domain/order/order';
import { OrderSide } from '@domain/order/order-side';
import { OrderType } from '@domain/order/order-type';
import { OrderStatus } from '@domain/order/order-status';
import { Grid } from '@domain/grid/grid';
import { GridId } from '@domain/grid/grid-id';
import { GridMode } from '@domain/grid/grid-mode';
import { TradingSymbol } from '@domain/primitives/trading-symbol';
import { Price } from '@domain/primitives/price';
import { Decimal } from '../../../../../domain/primitives/decimal';

describe('ProfitCalculatorService', () => {
    let service: ProfitCalculatorService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [ProfitCalculatorService],
        }).compile();

        service = module.get<ProfitCalculatorService>(ProfitCalculatorService);
    });

    function createGrid(lowerPrice: number, upperPrice: number, levels: number): Grid {
        return Grid.create({
            symbol: TradingSymbol.create('BTC'),
            mode: GridMode.Neutral,
            lowerPrice: Price.from(lowerPrice),
            upperPrice: Price.from(upperPrice),
            levels,
            investmentUSDC: Decimal.from(1000),
            investmentBase: Decimal.from(0.1),
            trailingEnabled: false,
            trailingTriggerPercent: 5,
            trailingStepPercent: 10,
            trailingPartialClosePercent: 50,
        });
    }

    function createOrder(side: OrderSide, amount: number): Order {
        return Order.create({
            symbol: TradingSymbol.create('BTC'),
            type: OrderType.Limit,
            side,
            price: Price.from(50000),
            amount: Decimal.from(amount),
            status: OrderStatus.Filled,
            gridId: GridId.from('550e8400-e29b-41d4-a716-446655440000'),
            levelIndex: 1,
        });
    }

    describe('calculate', () => {
        it('should return profit for SELL order', () => {
            const grid = createGrid(45000, 55000, 10);
            const order = createOrder(OrderSide.Sell, 0.01);

            const profit = service.calculate(order, grid);

            expect(profit).not.toBeNull();
            const spacing = grid.getGridSpacing().toNumber();
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
