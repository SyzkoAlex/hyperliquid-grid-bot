import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GridProcessorService } from './grid-processor.service';
import { Grid } from '../../domain/grid/grid';
import { GridId } from '../../domain/grid/grid-id';
import { GridMode } from '../../domain/grid/grid-mode';
import { GridStatus } from '../../domain/grid/grid-status';
import { Order } from '../../domain/order/order';
import { OrderId } from '../../domain/order/order-id';
import { OrderStatus } from '../../domain/order/order-status';
import { OrderSide } from '../../domain/order/order-side';
import { OrderType } from '../../domain/order/order-type';
import { Symbol } from '../../domain/common/symbol';
import { Price } from '../../domain/common/price';
import { Decimal } from '../../../../../domain/primitives/decimal';
import { ExchangeOpenOrder } from '../../domain/exchange-order/exchange-open-order';
import { ExchangeOrderStatus } from '../../domain/exchange-order/exchange-order-status';

describe('GridProcessorService', () => {
    let service: GridProcessorService;
    let mockOrderRepository: {
        findManyActive: ReturnType<typeof vi.fn>;
    };
    let mockOrderStatusSyncService: {
        process: ReturnType<typeof vi.fn>;
    };
    let mockOrderRefillService: {
        process: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        mockOrderRepository = {
            findManyActive: vi.fn(),
        };

        mockOrderStatusSyncService = {
            process: vi.fn(),
        };

        mockOrderRefillService = {
            process: vi.fn(),
        };

        service = new GridProcessorService(
            mockOrderRepository as any,
            mockOrderStatusSyncService as any,
            mockOrderRefillService as any,
        );
    });

    describe('process', () => {
        const gridId = GridId.from('550e8400-e29b-41d4-a716-446655440000');

        const createGrid = (): Grid =>
            Grid.create({
                id: gridId,
                symbol: Symbol.create('BTC'),
                mode: GridMode.Neutral,
                status: GridStatus.Running,
                lowerPrice: Price.from(45000),
                upperPrice: Price.from(55000),
                levels: 10,
                investmentUSDC: Decimal.from(5000),
                investmentBase: Decimal.from(0.1),
                trailingEnabled: false,
                trailingTriggerPercent: 5,
                trailingStepPercent: 2,
                trailingPartialClosePercent: 50,
            });

        const createOrder = (status: OrderStatus): Order =>
            Order.create({
                id: OrderId.create(),
                exchangeOrderId: 'exchange-123',
                symbol: Symbol.create('BTC'),
                type: OrderType.Limit,
                side: OrderSide.Buy,
                price: Price.from(50000),
                amount: Decimal.from(0.01),
                status,
                gridId: gridId.toString(),
                levelIndex: 5,
            });

        const createExchangeOrder = (): ExchangeOpenOrder => ({
            id: 'exchange-123',
            symbol: Symbol.create('BTC'),
            type: OrderType.Limit,
            side: OrderSide.Buy,
            price: Price.from(50000),
            amount: Decimal.from(0.01),
            filledAmount: Decimal.zero(),
            status: ExchangeOrderStatus.OPEN,
            reduceOnly: false,
            placedAt: Date.now(),
        });

        it('should return empty result when no active orders', async () => {
            const grid = createGrid();

            mockOrderRepository.findManyActive.mockResolvedValue([]);

            const result = await service.process(grid, []);

            expect(result.fills).toBe(0);
            expect(result.refills).toBe(0);
            expect(mockOrderStatusSyncService.process).not.toHaveBeenCalled();
            expect(mockOrderRefillService.process).not.toHaveBeenCalled();
        });

        it('should process active orders and detect fills', async () => {
            const grid = createGrid();
            const placedOrder = createOrder(OrderStatus.Placed);
            const exchangeOrders = [createExchangeOrder()];

            mockOrderRepository.findManyActive.mockResolvedValue([placedOrder]);
            mockOrderStatusSyncService.process.mockResolvedValue({
                filledOrders: [placedOrder],
                processed: 1,
                filled: 1,
                cancelled: 0,
                missing: 0,
            });
            mockOrderRefillService.process.mockResolvedValue({
                success: false,
                error: 'Edge level',
            });

            const result = await service.process(grid, exchangeOrders);

            expect(result.fills).toBe(1);
            expect(mockOrderStatusSyncService.process).toHaveBeenCalledWith(
                [placedOrder],
                exchangeOrders,
            );
            expect(mockOrderRefillService.process).toHaveBeenCalledWith(placedOrder, grid);
        });

        it('should process refills for filled orders', async () => {
            const grid = createGrid();
            const filledOrder = createOrder(OrderStatus.Filled);
            const exchangeOrders: ExchangeOpenOrder[] = [];

            mockOrderRepository.findManyActive.mockResolvedValue([filledOrder]);
            mockOrderStatusSyncService.process.mockResolvedValue({
                filledOrders: [filledOrder],
                processed: 1,
                filled: 1,
                cancelled: 0,
                missing: 0,
            });
            mockOrderRefillService.process.mockResolvedValue({
                success: true,
                orderId: OrderId.create().toString(),
            });

            const result = await service.process(grid, exchangeOrders);

            expect(result.fills).toBe(1);
            expect(result.refills).toBe(1);
            expect(mockOrderRefillService.process).toHaveBeenCalledWith(filledOrder, grid);
        });

        it('should handle multiple filled orders with refills', async () => {
            const grid = createGrid();
            const filledOrder1 = createOrder(OrderStatus.Filled);
            const filledOrder2 = createOrder(OrderStatus.Filled);

            mockOrderRepository.findManyActive.mockResolvedValue([filledOrder1, filledOrder2]);
            mockOrderStatusSyncService.process.mockResolvedValue({
                filledOrders: [filledOrder1, filledOrder2],
                processed: 2,
                filled: 2,
                cancelled: 0,
                missing: 0,
            });

            // First refill succeeds, second fails
            mockOrderRefillService.process
                .mockResolvedValueOnce({
                    success: true,
                    orderId: OrderId.create().toString(),
                })
                .mockResolvedValueOnce({
                    success: false,
                    error: 'Edge level',
                });

            const result = await service.process(grid, []);

            expect(result.fills).toBe(2);
            expect(result.refills).toBe(1);
            expect(mockOrderRefillService.process).toHaveBeenCalledTimes(2);
        });

        it('should increment only fills when refill fails', async () => {
            const grid = createGrid();
            const filledOrder = createOrder(OrderStatus.Filled);

            mockOrderRepository.findManyActive.mockResolvedValue([filledOrder]);
            mockOrderStatusSyncService.process.mockResolvedValue({
                filledOrders: [filledOrder],
                processed: 1,
                filled: 1,
                cancelled: 0,
                missing: 0,
            });
            mockOrderRefillService.process.mockResolvedValue({
                success: false,
                error: 'Insufficient balance',
            });

            const result = await service.process(grid, []);

            expect(result.fills).toBe(1);
            expect(result.refills).toBe(0);
        });

        it('should handle no filled orders', async () => {
            const grid = createGrid();
            const placedOrder = createOrder(OrderStatus.Placed);

            mockOrderRepository.findManyActive.mockResolvedValue([placedOrder]);
            mockOrderStatusSyncService.process.mockResolvedValue({
                filledOrders: [],
                processed: 1,
                filled: 0,
                cancelled: 0,
                missing: 0,
            });

            const result = await service.process(grid, []);

            expect(result.fills).toBe(0);
            expect(result.refills).toBe(0);
            expect(mockOrderRefillService.process).not.toHaveBeenCalled();
        });

        it('should call repository with correct grid id', async () => {
            const grid = createGrid();

            mockOrderRepository.findManyActive.mockResolvedValue([]);

            await service.process(grid, []);

            expect(mockOrderRepository.findManyActive).toHaveBeenCalledWith(grid.id);
        });

        it('should process all filled orders sequentially', async () => {
            const grid = createGrid();
            const order1 = createOrder(OrderStatus.Filled);
            const order2 = createOrder(OrderStatus.Filled);
            const order3 = createOrder(OrderStatus.Filled);

            mockOrderRepository.findManyActive.mockResolvedValue([order1, order2, order3]);
            mockOrderStatusSyncService.process.mockResolvedValue({
                filledOrders: [order1, order2, order3],
                processed: 3,
                filled: 3,
                cancelled: 0,
                missing: 0,
            });
            mockOrderRefillService.process.mockResolvedValue({
                success: true,
                orderId: OrderId.create().toString(),
            });

            const result = await service.process(grid, []);

            expect(result.fills).toBe(3);
            expect(result.refills).toBe(3);
            expect(mockOrderRefillService.process).toHaveBeenCalledTimes(3);
            expect(mockOrderRefillService.process).toHaveBeenNthCalledWith(1, order1, grid);
            expect(mockOrderRefillService.process).toHaveBeenNthCalledWith(2, order2, grid);
            expect(mockOrderRefillService.process).toHaveBeenNthCalledWith(3, order3, grid);
        });
    });
});
