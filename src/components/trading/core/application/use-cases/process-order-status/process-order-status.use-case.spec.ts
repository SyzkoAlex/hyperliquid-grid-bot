import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProcessOrderStatusUseCase } from './process-order-status.use-case';
import { Order } from '@domain/models/order/order';
import { OrderId } from '@domain/models/order/order-id';
import { OrderStatus } from '@domain/models/order/order-status';
import { OrderSide } from '@domain/models/order/order-side';
import { OrderType } from '@domain/models/order/order-type';
import { Grid } from '@domain/models/grid/grid';
import { GridId } from '@domain/models/grid/grid-id';
import { GridMode } from '@domain/models/grid/grid-mode';
import { GridStatus } from '@domain/models/grid/grid-status';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Price } from '@domain/models/primitives/price';
import { Decimal } from '@domain/models/primitives/decimal';
import { HyperliquidWsOrderStatus } from '@/infra/hyperliqued/types/hyperliquid-ws-user-event';

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

    const gridId = GridId.from('550e8400-e29b-41d4-a716-446655440000');

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

    const createOrder = (status: OrderStatus = OrderStatus.Placed): Order =>
        Order.create({
            id: OrderId.create(),
            exchangeOrderId: '123',
            symbol: TradingSymbol.create('BTC'),
            type: OrderType.Limit,
            side: OrderSide.Buy,
            price: Price.from(50000),
            amount: Decimal.from(0.01),
            status,
            gridId: gridId,
            levelIndex: 5,
        });

    const createGrid = (status: GridStatus = GridStatus.Running): Grid =>
        Grid.create({
            id: gridId,
            symbol: TradingSymbol.create('BTC'),
            mode: GridMode.Neutral,
            status,
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

    const createOrderStatus = (
        status: 'filled' | 'canceled' | 'marginCanceled' | 'rejected' | 'open' | 'triggered',
    ): HyperliquidWsOrderStatus =>
        ({
            order: {
                oid: 123,
                coin: 'BTC',
                side: 'B',
                limitPx: '50000',
                sz: '0.01',
                timestamp: Date.now(),
            },
            status,
            statusTimestamp: Date.now(),
        }) as any;

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
            mockOrderRefillService.processOne.mockResolvedValue({
                success: true,
                orderId: OrderId.create().toString(),
            });

            const result = await useCase.execute({ orderStatus });

            expect(result.success).toBe(true);
            expect(result.isGridOrder).toBe(true);
            expect(result.status).toBe('filled');
            expect(mockGrids.updateOrderStatus).toHaveBeenCalledWith(
                order.id.toString(),
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
                order.id.toString(),
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
                order.id.toString(),
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
            expect(mockGrids.updateOrderStatus).toHaveBeenCalledWith(
                order.id.toString(),
                OrderStatus.Failed,
            );
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
