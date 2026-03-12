import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderRestoreService } from './order-restore.service';
import { OrderStatus } from '@domain/models/order/order-status';
import { OrderSide } from '@domain/models/order/order-side';
import { OrderType } from '@domain/models/order/order-type';
import { ExchangeOpenOrder } from '@components/trading/core/domain/models/exchange-order/exchange-open-order';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Price } from '@domain/models/primitives/price';
import { Decimal } from '@domain/models/primitives/decimal';
import { ExchangeOrderStatus } from '@components/trading/core/domain/models/exchange-order/exchange-order-status';
import { ExchangeCloid } from '@components/trading/core/domain/models/exchange-order/exchange-cloid';
import { OrderDto } from '@components/grids/api/dto/order.dto';

describe('OrderRestoreService', () => {
    let service: OrderRestoreService;
    let mockOrderRepository: {
        findOrdersByStatus: ReturnType<typeof vi.fn>;
        updateOrderExchangeId: ReturnType<typeof vi.fn>;
        updateOrderStatus: ReturnType<typeof vi.fn>;
    };
    let mockConfigService: {
        get: ReturnType<typeof vi.fn>;
    };

    const staleThresholdMs = 60000; // 1 minute
    const gridId = '550e8400-e29b-41d4-a716-446655440000';

    beforeEach(() => {
        mockOrderRepository = {
            findOrdersByStatus: vi.fn(),
            updateOrderExchangeId: vi.fn(),
            updateOrderStatus: vi.fn(),
        };

        mockConfigService = {
            get: vi.fn((key: string) => {
                if (key === 'orders') {
                    return {
                        pendingCleanupThresholdMs: staleThresholdMs,
                    };
                }
                return undefined;
            }),
        };

        service = new OrderRestoreService(mockOrderRepository as any, mockConfigService as any);
    });

    describe('restoreOrders', () => {
        const createPendingOrder = (orderId?: string, placedAt?: number): OrderDto => ({
            id: orderId ?? crypto.randomUUID(),
            gridId,
            symbol: 'BTC',
            type: OrderType.Limit,
            side: OrderSide.Buy,
            price: 50000,
            amount: 0.01,
            status: OrderStatus.Pending,
            levelIndex: 5,
            exchangeOrderId: null,
            createdAt: Date.now(),
            placedAt,
        });

        const createExchangeOrder = (
            exchangeOrderId: string,
            cloid?: ExchangeCloid,
        ): ExchangeOpenOrder => ({
            id: exchangeOrderId,
            cloid,
            symbol: TradingSymbol.create('BTC'),
            type: OrderType.Limit,
            side: OrderSide.Buy,
            price: Price.from(50000),
            amount: Decimal.from(0.01),
            filledAmount: Decimal.zero(),
            status: ExchangeOrderStatus.OPEN,
            reduceOnly: false,
            placedAt: Date.now(),
        });

        it('should return 0 when no pending orders exist', async () => {
            mockOrderRepository.findOrdersByStatus.mockResolvedValue([]);

            const result = await service.restoreOrders([]);

            expect(result).toBe(0);
            expect(mockOrderRepository.findOrdersByStatus).toHaveBeenCalledWith(
                OrderStatus.Pending,
            );
            expect(mockOrderRepository.updateOrderExchangeId).not.toHaveBeenCalled();
        });

        it('should restore order by matching cloid', async () => {
            const orderId = crypto.randomUUID();
            const cloid = ExchangeCloid.create(orderId);
            const pendingOrder = createPendingOrder(orderId);
            const exchangeOrder = createExchangeOrder('exchange-order-1', cloid);

            mockOrderRepository.findOrdersByStatus.mockResolvedValue([pendingOrder]);

            const result = await service.restoreOrders([exchangeOrder]);

            expect(result).toBe(1);
            expect(mockOrderRepository.updateOrderExchangeId).toHaveBeenCalledWith(
                pendingOrder.id,
                'exchange-order-1',
                OrderStatus.Placed,
                expect.any(Date),
            );
        });

        it('should restore multiple orders with different cloids', async () => {
            const orderId1 = crypto.randomUUID();
            const orderId2 = crypto.randomUUID();
            const cloid1 = ExchangeCloid.create(orderId1);
            const cloid2 = ExchangeCloid.create(orderId2);

            const pendingOrder1 = createPendingOrder(orderId1);
            const pendingOrder2 = createPendingOrder(orderId2);
            const exchangeOrder1 = createExchangeOrder('exchange-order-1', cloid1);
            const exchangeOrder2 = createExchangeOrder('exchange-order-2', cloid2);

            mockOrderRepository.findOrdersByStatus.mockResolvedValue([
                pendingOrder1,
                pendingOrder2,
            ]);

            const result = await service.restoreOrders([exchangeOrder1, exchangeOrder2]);

            expect(result).toBe(2);
            expect(mockOrderRepository.updateOrderExchangeId).toHaveBeenCalledTimes(2);
        });

        it('should not restore order without cloid', async () => {
            const pendingOrder = createPendingOrder();

            mockOrderRepository.findOrdersByStatus.mockResolvedValue([pendingOrder]);

            const result = await service.restoreOrders([]);

            expect(result).toBe(0);
            expect(mockOrderRepository.updateOrderExchangeId).not.toHaveBeenCalled();
        });

        it('should not restore when no matching exchange order found', async () => {
            const orderId = crypto.randomUUID();
            const differentOrderId = crypto.randomUUID();
            const pendingOrder = createPendingOrder(orderId);
            const differentCloid = ExchangeCloid.create(differentOrderId);
            const exchangeOrder = createExchangeOrder('exchange-order-1', differentCloid);

            mockOrderRepository.findOrdersByStatus.mockResolvedValue([pendingOrder]);

            const result = await service.restoreOrders([exchangeOrder]);

            expect(result).toBe(0);
            expect(mockOrderRepository.updateOrderExchangeId).not.toHaveBeenCalled();
        });

        it('should skip restoration when multiple exchange orders have same cloid', async () => {
            const orderId = crypto.randomUUID();
            const cloid = ExchangeCloid.create(orderId);
            const pendingOrder = createPendingOrder(orderId);
            const exchangeOrder1 = createExchangeOrder('exchange-order-1', cloid);
            const exchangeOrder2 = createExchangeOrder('exchange-order-2', cloid);

            mockOrderRepository.findOrdersByStatus.mockResolvedValue([pendingOrder]);

            const result = await service.restoreOrders([exchangeOrder1, exchangeOrder2]);

            expect(result).toBe(0);
            expect(mockOrderRepository.updateOrderExchangeId).not.toHaveBeenCalled();
        });

        it('should mark stale pending order as missing when not found on exchange', async () => {
            const orderId = crypto.randomUUID();
            const stalePlacedAt = Date.now() - staleThresholdMs - 1000;
            const stalePendingOrder = createPendingOrder(orderId, stalePlacedAt);

            mockOrderRepository.findOrdersByStatus.mockResolvedValue([stalePendingOrder]);

            const result = await service.restoreOrders([]);

            expect(result).toBe(0);
            expect(mockOrderRepository.updateOrderStatus).toHaveBeenCalledWith(
                stalePendingOrder.id,
                OrderStatus.Missing,
            );
        });

        it('should not mark fresh pending order as missing', async () => {
            const orderId = crypto.randomUUID();
            const freshPlacedAt = Date.now() - 1000; // 1 second ago
            const freshPendingOrder = createPendingOrder(orderId, freshPlacedAt);

            mockOrderRepository.findOrdersByStatus.mockResolvedValue([freshPendingOrder]);

            const result = await service.restoreOrders([]);

            expect(result).toBe(0);
            expect(mockOrderRepository.updateOrderStatus).not.toHaveBeenCalled();
        });

        it('should not mark pending order without placedAt as missing when createdAt is fresh', async () => {
            const orderId = crypto.randomUUID();
            const pendingOrder = createPendingOrder(orderId, undefined);

            mockOrderRepository.findOrdersByStatus.mockResolvedValue([pendingOrder]);

            const result = await service.restoreOrders([]);

            expect(result).toBe(0);
            expect(mockOrderRepository.updateOrderStatus).not.toHaveBeenCalled();
        });

        it('should mark pending order as missing when placedAt is absent but createdAt is stale', async () => {
            const orderId = crypto.randomUUID();
            const staleCreatedAt = Date.now() - staleThresholdMs - 1000;
            const pendingOrder: OrderDto = {
                ...createPendingOrder(orderId, undefined),
                createdAt: staleCreatedAt,
            };

            mockOrderRepository.findOrdersByStatus.mockResolvedValue([pendingOrder]);

            const result = await service.restoreOrders([]);

            expect(result).toBe(0);
            expect(mockOrderRepository.updateOrderStatus).toHaveBeenCalledWith(
                orderId,
                OrderStatus.Missing,
            );
        });

        it('should restore some orders and mark others as missing', async () => {
            const orderId1 = crypto.randomUUID();
            const orderId2 = crypto.randomUUID();
            const cloid1 = ExchangeCloid.create(orderId1);

            const stalePlacedAt = Date.now() - staleThresholdMs - 1000;

            const pendingOrder1 = createPendingOrder(orderId1);
            const pendingOrder2 = createPendingOrder(orderId2, stalePlacedAt);

            const exchangeOrder1 = createExchangeOrder('exchange-order-1', cloid1);

            mockOrderRepository.findOrdersByStatus.mockResolvedValue([
                pendingOrder1,
                pendingOrder2,
            ]);

            const result = await service.restoreOrders([exchangeOrder1]);

            expect(result).toBe(1);
            expect(mockOrderRepository.updateOrderExchangeId).toHaveBeenCalledWith(
                pendingOrder1.id,
                'exchange-order-1',
                OrderStatus.Placed,
                expect.any(Date),
            );
            expect(mockOrderRepository.updateOrderStatus).toHaveBeenCalledWith(
                pendingOrder2.id,
                OrderStatus.Missing,
            );
        });

        it('should handle exchange orders without cloid', async () => {
            const orderId = crypto.randomUUID();
            const pendingOrder = createPendingOrder(orderId);
            const exchangeOrderWithoutCloid = createExchangeOrder('exchange-order-1', undefined);

            mockOrderRepository.findOrdersByStatus.mockResolvedValue([pendingOrder]);

            const result = await service.restoreOrders([exchangeOrderWithoutCloid]);

            expect(result).toBe(0);
            expect(mockOrderRepository.updateOrderExchangeId).not.toHaveBeenCalled();
        });

        it('should match cloid by string comparison', async () => {
            const orderId = crypto.randomUUID();
            const cloid = ExchangeCloid.create(orderId);
            const pendingOrder = createPendingOrder(orderId);
            const exchangeOrder = createExchangeOrder('exchange-order-1', cloid);

            mockOrderRepository.findOrdersByStatus.mockResolvedValue([pendingOrder]);

            const result = await service.restoreOrders([exchangeOrder]);

            expect(result).toBe(1);
            expect(mockOrderRepository.updateOrderExchangeId).toHaveBeenCalledWith(
                pendingOrder.id,
                'exchange-order-1',
                OrderStatus.Placed,
                expect.any(Date),
            );
        });
    });
});
