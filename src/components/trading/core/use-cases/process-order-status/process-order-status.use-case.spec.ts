import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProcessOrderStatusUseCase } from './process-order-status.use-case';
import { Order } from '../../domain/order/order';
import { OrderId } from '../../domain/order/order-id';
import { OrderStatus } from '../../domain/order/order-status';
import { OrderSide } from '../../domain/order/order-side';
import { OrderType } from '../../domain/order/order-type';
import { Grid } from '../../domain/grid/grid';
import { GridId } from '../../domain/grid/grid-id';
import { GridMode } from '../../domain/grid/grid-mode';
import { GridStatus } from '../../domain/grid/grid-status';
import { Symbol } from '../../domain/common/symbol';
import { Price } from '../../domain/common/price';
import { Decimal } from '../../../../../domain/primitives/decimal';
import { HyperliquidWsOrderStatus } from '../../../secondary/client/hyperliquid/types/hyperliquid-ws-user-event';

describe('ProcessOrderStatusUseCase', () => {
    let useCase: ProcessOrderStatusUseCase;
    let mockOrderRepository: {
        findOneByExchangeOrderId: ReturnType<typeof vi.fn>;
        updateStatus: ReturnType<typeof vi.fn>;
    };
    let mockGridRepository: {
        findOneById: ReturnType<typeof vi.fn>;
    };
    let mockOrderRefillService: {
        process: ReturnType<typeof vi.fn>;
    };

    const gridId = GridId.from('550e8400-e29b-41d4-a716-446655440000');

    beforeEach(() => {
        mockOrderRepository = {
            findOneByExchangeOrderId: vi.fn(),
            updateStatus: vi.fn(),
        };

        mockGridRepository = {
            findOneById: vi.fn(),
        };

        mockOrderRefillService = {
            process: vi.fn(),
        };

        useCase = new ProcessOrderStatusUseCase(
            mockOrderRepository as any,
            mockGridRepository as any,
            mockOrderRefillService as any,
        );
    });

    const createOrder = (status: OrderStatus = OrderStatus.Placed): Order =>
        Order.create({
            id: OrderId.create(),
            exchangeOrderId: '123',
            symbol: Symbol.create('BTC'),
            type: OrderType.Limit,
            side: OrderSide.Buy,
            price: Price.from(50000),
            amount: Decimal.from(0.01),
            status,
            gridId: gridId.toString(),
            levelIndex: 5,
        });

    const createGrid = (status: GridStatus = GridStatus.Running): Grid =>
        Grid.create({
            id: gridId,
            symbol: Symbol.create('BTC'),
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

            mockOrderRepository.findOneByExchangeOrderId.mockResolvedValue(null);

            const result = await useCase.execute({ orderStatus });

            expect(result.success).toBe(true);
            expect(result.isGridOrder).toBe(false);
            expect(result.orderId).toBe(123);
            expect(result.status).toBe('filled');
        });
    });

    describe('execute - filled status', () => {
        it('should process filled order and trigger refill', async () => {
            const orderStatus = createOrderStatus('filled');
            const order = createOrder(OrderStatus.Placed);
            const grid = createGrid(GridStatus.Running);
            const filledOrder = createOrder(OrderStatus.Filled);

            mockOrderRepository.findOneByExchangeOrderId
                .mockResolvedValueOnce(order)
                .mockResolvedValueOnce(filledOrder);
            mockGridRepository.findOneById.mockResolvedValue(grid);
            mockOrderRefillService.process.mockResolvedValue({
                success: true,
                orderId: OrderId.create().toString(),
            });

            const result = await useCase.execute({ orderStatus });

            expect(result.success).toBe(true);
            expect(result.isGridOrder).toBe(true);
            expect(result.status).toBe('filled');
            expect(mockOrderRepository.updateStatus).toHaveBeenCalledWith(
                order.id.toString(),
                OrderStatus.Filled,
                expect.any(Date),
            );
            expect(mockOrderRefillService.process).toHaveBeenCalledWith(filledOrder, grid);
        });

        it('should skip processing if order already filled', async () => {
            const orderStatus = createOrderStatus('filled');
            const order = createOrder(OrderStatus.Filled);

            mockOrderRepository.findOneByExchangeOrderId.mockResolvedValue(order);

            const result = await useCase.execute({ orderStatus });

            expect(result.success).toBe(true);
            expect(result.isGridOrder).toBe(true);
            expect(result.status).toBe('filled');
            expect(mockOrderRepository.updateStatus).not.toHaveBeenCalled();
            expect(mockOrderRefillService.process).not.toHaveBeenCalled();
        });

        it('should return error when grid not found', async () => {
            const orderStatus = createOrderStatus('filled');
            const order = createOrder(OrderStatus.Placed);

            mockOrderRepository.findOneByExchangeOrderId.mockResolvedValue(order);
            mockGridRepository.findOneById.mockResolvedValue(null);

            const result = await useCase.execute({ orderStatus });

            expect(result.success).toBe(false);
            expect(result.isGridOrder).toBe(true);
            expect(result.error).toBe('Grid not found');
        });

        it('should skip refill when grid is not running', async () => {
            const orderStatus = createOrderStatus('filled');
            const order = createOrder(OrderStatus.Placed);
            const grid = createGrid(GridStatus.Stopped);

            mockOrderRepository.findOneByExchangeOrderId.mockResolvedValue(order);
            mockGridRepository.findOneById.mockResolvedValue(grid);

            const result = await useCase.execute({ orderStatus });

            expect(result.success).toBe(true);
            expect(result.isGridOrder).toBe(true);
            expect(result.status).toBe('filled');
            expect(mockOrderRefillService.process).not.toHaveBeenCalled();
        });

        it('should return error when order refetch fails', async () => {
            const orderStatus = createOrderStatus('filled');
            const order = createOrder(OrderStatus.Placed);
            const grid = createGrid(GridStatus.Running);

            mockOrderRepository.findOneByExchangeOrderId
                .mockResolvedValueOnce(order)
                .mockResolvedValueOnce(null);
            mockGridRepository.findOneById.mockResolvedValue(grid);

            const result = await useCase.execute({ orderStatus });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to re-fetch order');
            expect(mockOrderRefillService.process).not.toHaveBeenCalled();
        });

        it('should continue when refill fails', async () => {
            const orderStatus = createOrderStatus('filled');
            const order = createOrder(OrderStatus.Placed);
            const grid = createGrid(GridStatus.Running);
            const filledOrder = createOrder(OrderStatus.Filled);

            mockOrderRepository.findOneByExchangeOrderId
                .mockResolvedValueOnce(order)
                .mockResolvedValueOnce(filledOrder);
            mockGridRepository.findOneById.mockResolvedValue(grid);
            mockOrderRefillService.process.mockResolvedValue({
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
        it('should process canceled order', async () => {
            const orderStatus = createOrderStatus('canceled');
            const order = createOrder(OrderStatus.Placed);

            mockOrderRepository.findOneByExchangeOrderId.mockResolvedValue(order);

            const result = await useCase.execute({ orderStatus });

            expect(result.success).toBe(true);
            expect(result.isGridOrder).toBe(true);
            expect(result.status).toBe('canceled');
            expect(mockOrderRepository.updateStatus).toHaveBeenCalledWith(
                order.id.toString(),
                OrderStatus.Cancelled,
            );
        });

        it('should process marginCanceled order', async () => {
            const orderStatus = createOrderStatus('marginCanceled');
            const order = createOrder(OrderStatus.Placed);

            mockOrderRepository.findOneByExchangeOrderId.mockResolvedValue(order);

            const result = await useCase.execute({ orderStatus });

            expect(result.success).toBe(true);
            expect(result.isGridOrder).toBe(true);
            expect(result.status).toBe('marginCanceled');
            expect(mockOrderRepository.updateStatus).toHaveBeenCalledWith(
                order.id.toString(),
                OrderStatus.Cancelled,
            );
        });

        it('should skip if already cancelled', async () => {
            const orderStatus = createOrderStatus('canceled');
            const order = createOrder(OrderStatus.Cancelled);

            mockOrderRepository.findOneByExchangeOrderId.mockResolvedValue(order);

            const result = await useCase.execute({ orderStatus });

            expect(result.success).toBe(true);
            expect(result.isGridOrder).toBe(true);
            expect(mockOrderRepository.updateStatus).not.toHaveBeenCalled();
        });
    });

    describe('execute - rejected status', () => {
        it('should process rejected order', async () => {
            const orderStatus = createOrderStatus('rejected');
            const order = createOrder(OrderStatus.Placed);

            mockOrderRepository.findOneByExchangeOrderId.mockResolvedValue(order);

            const result = await useCase.execute({ orderStatus });

            expect(result.success).toBe(true);
            expect(result.isGridOrder).toBe(true);
            expect(result.status).toBe('failed');
            expect(mockOrderRepository.updateStatus).toHaveBeenCalledWith(
                order.id.toString(),
                OrderStatus.Failed,
            );
        });
    });

    describe('execute - open and triggered statuses', () => {
        it('should handle open status without action', async () => {
            const orderStatus = createOrderStatus('open');
            const order = createOrder(OrderStatus.Placed);

            mockOrderRepository.findOneByExchangeOrderId.mockResolvedValue(order);

            const result = await useCase.execute({ orderStatus });

            expect(result.success).toBe(true);
            expect(result.isGridOrder).toBe(true);
            expect(result.status).toBe('open');
            expect(mockOrderRepository.updateStatus).not.toHaveBeenCalled();
        });

        it('should handle triggered status without action', async () => {
            const orderStatus = createOrderStatus('triggered');
            const order = createOrder(OrderStatus.Placed);

            mockOrderRepository.findOneByExchangeOrderId.mockResolvedValue(order);

            const result = await useCase.execute({ orderStatus });

            expect(result.success).toBe(true);
            expect(result.isGridOrder).toBe(true);
            expect(result.status).toBe('triggered');
            expect(mockOrderRepository.updateStatus).not.toHaveBeenCalled();
        });
    });

    describe('execute - error handling', () => {
        it('should handle repository errors', async () => {
            const orderStatus = createOrderStatus('filled');

            mockOrderRepository.findOneByExchangeOrderId.mockRejectedValue(
                new Error('Database error'),
            );

            const result = await useCase.execute({ orderStatus });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Database error');
        });

        it('should handle non-Error exceptions', async () => {
            const orderStatus = createOrderStatus('filled');

            mockOrderRepository.findOneByExchangeOrderId.mockRejectedValue('String error');

            const result = await useCase.execute({ orderStatus });

            expect(result.success).toBe(false);
            expect(result.error).toBe('String error');
        });
    });
});
