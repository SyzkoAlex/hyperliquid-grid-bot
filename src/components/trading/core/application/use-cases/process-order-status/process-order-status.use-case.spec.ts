import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProcessOrderStatusUseCase } from './process-order-status.use-case';
import { OrderDto } from '@components/grids/api/dto/order.dto';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { OrderStatusUpdate } from './order-status-update';
import { OrderSide } from '@domain/models/order/order-side';
import { OrderStatus } from '@domain/models/order/order-status';
import { OrderType } from '@domain/models/order/order-type';
import { GridMode } from '@domain/models/grid/grid-mode';
import { GridStatus } from '@domain/models/grid/grid-status';

describe('ProcessOrderStatusUseCase', () => {
    let useCase: ProcessOrderStatusUseCase;
    let mockGrids: {
        findOrderByExchangeId: ReturnType<typeof vi.fn>;
        updateOrderStatus: ReturnType<typeof vi.fn>;
        findGridById: ReturnType<typeof vi.fn>;
    };
    let mockOrderRefillService: {
        processOne: ReturnType<typeof vi.fn>;
    };

    const gridId = '550e8400-e29b-41d4-a716-446655440000';

    beforeEach(() => {
        mockGrids = {
            findOrderByExchangeId: vi.fn(),
            updateOrderStatus: vi.fn(),
            findGridById: vi.fn(),
        };

        mockOrderRefillService = {
            processOne: vi.fn(),
        };

        useCase = new ProcessOrderStatusUseCase(mockGrids as any, mockOrderRefillService as any);
    });

    const createOrder = (status: OrderStatus = OrderStatus.Placed): OrderDto => ({
        id: '660e8400-e29b-41d4-a716-446655440001',
        gridId,
        symbol: 'BTC',
        side: OrderSide.Buy,
        status,
        type: OrderType.Limit,
        levelIndex: 5,
        price: 50000,
        amount: 0.01,
        exchangeOrderId: '123',
        createdAt: Date.now(),
    });

    const createGrid = (status: GridStatus = GridStatus.Running): GridDto => ({
        id: gridId,
        symbol: 'BTC',
        mode: GridMode.Neutral,
        status,
        lowerPrice: 45000,
        upperPrice: 55000,
        levels: 10,
        investmentUSDC: 5000,
        investmentBase: 0.1,
        trailingEnabled: false,
        trailingTriggerPercent: 5,
        trailingStepPercent: 2,
        trailingPartialClosePercent: 50,
    });

    const createOrderStatus = (
        status: 'filled' | 'canceled' | 'marginCanceled' | 'rejected' | 'open' | 'triggered',
    ): OrderStatusUpdate => ({
        exchangeOrderId: 123,
        coin: 'BTC',
        status,
        statusTimestamp: Date.now(),
    });

    describe('execute - order not found', () => {
        it('should return success false when order is not a grid order', async () => {
            const orderStatus = createOrderStatus('filled');

            mockGrids.findOrderByExchangeId.mockResolvedValue(null);

            const result = await useCase.execute({ orderStatus });

            expect(result.success).toBe(true);
            expect(result.isGridOrder).toBe(false);
            expect(result.orderId).toBe(123);
            expect(result.status).toBe('filled');
        });
    });

    describe('execute - filled status', () => {
        it('should handle filled order and trigger refill', async () => {
            const orderStatus = createOrderStatus('filled');
            const order = createOrder(OrderStatus.Placed);
            const grid = createGrid(GridStatus.Running);
            const filledOrder = createOrder(OrderStatus.Filled);

            mockGrids.findOrderByExchangeId
                .mockResolvedValueOnce(order)
                .mockResolvedValueOnce(filledOrder);
            mockGrids.findGridById.mockResolvedValue(grid);
            mockOrderRefillService.processOne.mockResolvedValue({ success: true });

            const result = await useCase.execute({ orderStatus });

            expect(result.success).toBe(true);
            expect(result.isGridOrder).toBe(true);
            expect(result.status).toBe('filled');
            expect(mockGrids.updateOrderStatus).toHaveBeenCalledWith(
                order.id,
                OrderStatus.Filled,
                expect.any(Date),
            );
            expect(mockOrderRefillService.processOne).toHaveBeenCalledWith(filledOrder, grid);
        });

        it('should skip processing if order already filled', async () => {
            const orderStatus = createOrderStatus('filled');
            const order = createOrder(OrderStatus.Filled);

            mockGrids.findOrderByExchangeId.mockResolvedValue(order);

            const result = await useCase.execute({ orderStatus });

            expect(result.success).toBe(true);
            expect(result.isGridOrder).toBe(true);
            expect(result.status).toBe('filled');
            expect(mockGrids.updateOrderStatus).not.toHaveBeenCalled();
            expect(mockOrderRefillService.processOne).not.toHaveBeenCalled();
        });

        it('should return error when grid not found', async () => {
            const orderStatus = createOrderStatus('filled');
            const order = createOrder(OrderStatus.Placed);

            mockGrids.findOrderByExchangeId.mockResolvedValue(order);
            mockGrids.findGridById.mockResolvedValue(null);

            const result = await useCase.execute({ orderStatus });

            expect(result.success).toBe(false);
            expect(result.isGridOrder).toBe(true);
            expect(result.error).toBe('Grid not found');
        });

        it('should skip refill when grid is not running', async () => {
            const orderStatus = createOrderStatus('filled');
            const order = createOrder(OrderStatus.Placed);
            const grid = createGrid(GridStatus.Stopped);

            mockGrids.findOrderByExchangeId.mockResolvedValue(order);
            mockGrids.findGridById.mockResolvedValue(grid);

            const result = await useCase.execute({ orderStatus });

            expect(result.success).toBe(true);
            expect(result.isGridOrder).toBe(true);
            expect(result.status).toBe('filled');
            expect(mockOrderRefillService.processOne).not.toHaveBeenCalled();
        });

        it('should return error when order refetch fails', async () => {
            const orderStatus = createOrderStatus('filled');
            const order = createOrder(OrderStatus.Placed);
            const grid = createGrid(GridStatus.Running);

            mockGrids.findOrderByExchangeId
                .mockResolvedValueOnce(order)
                .mockResolvedValueOnce(null);
            mockGrids.findGridById.mockResolvedValue(grid);

            const result = await useCase.execute({ orderStatus });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to re-fetch order');
            expect(mockOrderRefillService.processOne).not.toHaveBeenCalled();
        });

        it('should continue when refill fails', async () => {
            const orderStatus = createOrderStatus('filled');
            const order = createOrder(OrderStatus.Placed);
            const grid = createGrid(GridStatus.Running);
            const filledOrder = createOrder(OrderStatus.Filled);

            mockGrids.findOrderByExchangeId
                .mockResolvedValueOnce(order)
                .mockResolvedValueOnce(filledOrder);
            mockGrids.findGridById.mockResolvedValue(grid);
            mockOrderRefillService.processOne.mockResolvedValue({
                success: false,
                error: 'Insufficient balance',
            });

            const result = await useCase.execute({ orderStatus });

            expect(result.success).toBe(true);
            expect(result.isGridOrder).toBe(true);
            expect(result.status).toBe('filled');
        });
    });

    describe('execute - canceled status', () => {
        it('should handle canceled order', async () => {
            const orderStatus = createOrderStatus('canceled');
            const order = createOrder(OrderStatus.Placed);

            mockGrids.findOrderByExchangeId.mockResolvedValue(order);

            const result = await useCase.execute({ orderStatus });

            expect(result.success).toBe(true);
            expect(result.isGridOrder).toBe(true);
            expect(result.status).toBe('canceled');
            expect(mockGrids.updateOrderStatus).toHaveBeenCalledWith(
                order.id,
                OrderStatus.Cancelled,
            );
        });

        it('should handle marginCanceled order', async () => {
            const orderStatus = createOrderStatus('marginCanceled');
            const order = createOrder(OrderStatus.Placed);

            mockGrids.findOrderByExchangeId.mockResolvedValue(order);

            const result = await useCase.execute({ orderStatus });

            expect(result.success).toBe(true);
            expect(result.isGridOrder).toBe(true);
            expect(result.status).toBe('marginCanceled');
            expect(mockGrids.updateOrderStatus).toHaveBeenCalledWith(
                order.id,
                OrderStatus.Cancelled,
            );
        });

        it('should skip if already cancelled', async () => {
            const orderStatus = createOrderStatus('canceled');
            const order = createOrder(OrderStatus.Cancelled);

            mockGrids.findOrderByExchangeId.mockResolvedValue(order);

            const result = await useCase.execute({ orderStatus });

            expect(result.success).toBe(true);
            expect(result.isGridOrder).toBe(true);
            expect(mockGrids.updateOrderStatus).not.toHaveBeenCalled();
        });
    });

    describe('execute - rejected status', () => {
        it('should handle rejected order', async () => {
            const orderStatus = createOrderStatus('rejected');
            const order = createOrder(OrderStatus.Placed);

            mockGrids.findOrderByExchangeId.mockResolvedValue(order);

            const result = await useCase.execute({ orderStatus });

            expect(result.success).toBe(true);
            expect(result.isGridOrder).toBe(true);
            expect(result.status).toBe('failed');
            expect(mockGrids.updateOrderStatus).toHaveBeenCalledWith(order.id, OrderStatus.Failed);
        });
    });

    describe('execute - open and triggered statuses', () => {
        it('should handle open status without action', async () => {
            const orderStatus = createOrderStatus('open');
            const order = createOrder(OrderStatus.Placed);

            mockGrids.findOrderByExchangeId.mockResolvedValue(order);

            const result = await useCase.execute({ orderStatus });

            expect(result.success).toBe(true);
            expect(result.isGridOrder).toBe(true);
            expect(result.status).toBe('open');
            expect(mockGrids.updateOrderStatus).not.toHaveBeenCalled();
        });

        it('should handle triggered status without action', async () => {
            const orderStatus = createOrderStatus('triggered');
            const order = createOrder(OrderStatus.Placed);

            mockGrids.findOrderByExchangeId.mockResolvedValue(order);

            const result = await useCase.execute({ orderStatus });

            expect(result.success).toBe(true);
            expect(result.isGridOrder).toBe(true);
            expect(result.status).toBe('triggered');
            expect(mockGrids.updateOrderStatus).not.toHaveBeenCalled();
        });
    });

    describe('execute - error handling', () => {
        it('should handle repository errors', async () => {
            const orderStatus = createOrderStatus('filled');

            mockGrids.findOrderByExchangeId.mockRejectedValue(new Error('Database error'));

            const result = await useCase.execute({ orderStatus });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Database error');
        });

        it('should handle non-Error exceptions', async () => {
            const orderStatus = createOrderStatus('filled');

            mockGrids.findOrderByExchangeId.mockRejectedValue('String error');

            const result = await useCase.execute({ orderStatus });

            expect(result.success).toBe(false);
            expect(result.error).toBe('String error');
        });
    });
});
