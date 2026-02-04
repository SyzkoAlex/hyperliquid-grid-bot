import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderStatusSyncService } from './order-status-sync.service';
import { Order } from '../../domain/order/order';
import { OrderStatus } from '../../domain/order/order-status';
import { OrderSide } from '../../domain/order/order-side';
import { OrderType } from '../../domain/order/order-type';
import { ExchangeOpenOrder } from '../../domain/exchange-order/exchange-open-order';
import { Symbol } from '../../domain/common/symbol';
import { Price } from '../../domain/common/price';
import { Decimal } from '../../../../../domain/primitives/decimal';
import { GridId } from '../../domain/grid/grid-id';
import { OrderId } from '../../domain/order/order-id';
import { ExchangeOrderStatus } from '../../domain/exchange-order/exchange-order-status';

describe('OrderStatusSyncService', () => {
    let service: OrderStatusSyncService;
    let mockOrderClient: {
        getOrderStatus: ReturnType<typeof vi.fn>;
    };
    let mockConfigService: {
        get: ReturnType<typeof vi.fn>;
    };
    let mockOrderRepository: {
        updateStatus: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        mockOrderClient = {
            getOrderStatus: vi.fn(),
        };

        mockConfigService = {
            get: vi.fn((key: string) => {
                if (key === 'hyperliquid') {
                    return {
                        accountAddress: '0x1234567890123456789012345678901234567890',
                    };
                }
                return undefined;
            }),
        };

        mockOrderRepository = {
            updateStatus: vi.fn(),
        };

        service = new OrderStatusSyncService(
            mockOrderClient as any,
            mockConfigService as any,
            mockOrderRepository as any,
        );
    });

    describe('process', () => {
        const gridId = GridId.from('550e8400-e29b-41d4-a716-446655440000');

        const createDbOrder = (exchangeOrderId: string): Order =>
            Order.create({
                id: OrderId.create(),
                exchangeOrderId,
                symbol: Symbol.create('BTC'),
                type: OrderType.Limit,
                side: OrderSide.Buy,
                price: Price.from(50000),
                amount: Decimal.from(0.01),
                status: OrderStatus.Placed,
                gridId: gridId,
                levelIndex: 5,
            });

        const createExchangeOrder = (exchangeOrderId: string): ExchangeOpenOrder => ({
            id: exchangeOrderId,
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

        const createHistoryRecord = (
            exchangeOrderId: string,
            status: ExchangeOrderStatus,
            statusTimestamp = Date.now(),
        ) => ({
            exchangeOrderId,
            status,
            statusTimestamp,
        });

        const mockOrderStatus = (
            orderStatuses: Map<string, { status: ExchangeOrderStatus; statusTimestamp?: number }>,
        ) => {
            mockOrderClient.getOrderStatus.mockImplementation(
                async (_user: string, oid: string) => {
                    const statusData = orderStatuses.get(oid);
                    if (!statusData) {
                        return null;
                    }
                    return createHistoryRecord(
                        oid,
                        statusData.status,
                        statusData.statusTimestamp || Date.now(),
                    );
                },
            );
        };

        it('should detect filled orders and return them', async () => {
            const order1 = createDbOrder('order-1');
            const order2 = createDbOrder('order-2');
            const dbOrders = [order1, order2];

            mockOrderStatus(
                new Map([
                    ['order-1', { status: ExchangeOrderStatus.FILLED }],
                    ['order-2', { status: ExchangeOrderStatus.FILLED }],
                ]),
            );

            const result = await service.process(dbOrders, []);

            expect(result.filledOrders).toHaveLength(2);
            expect(result.filledOrders).toContainEqual(order1);
            expect(result.filledOrders).toContainEqual(order2);
            expect(result.processed).toBe(2);
            expect(result.filled).toBe(2);
            expect(mockOrderRepository.updateStatus).toHaveBeenCalledTimes(2);
        });

        it('should process cancelled orders but not return them', async () => {
            const order1 = createDbOrder('order-1');
            const dbOrders = [order1];

            mockOrderStatus(new Map([['order-1', { status: ExchangeOrderStatus.CANCELED }]]));

            const result = await service.process(dbOrders, []);

            expect(result.filledOrders).toHaveLength(0);
            expect(result.processed).toBe(1);
            expect(result.cancelled).toBe(1);
            expect(mockOrderRepository.updateStatus).toHaveBeenCalledWith(
                order1.id.toString(),
                OrderStatus.Cancelled,
                undefined,
            );
        });

        it('should handle mixed status changes', async () => {
            const order1 = createDbOrder('order-1');
            const order2 = createDbOrder('order-2');
            const order3 = createDbOrder('order-3');
            const dbOrders = [order1, order2, order3];

            mockOrderStatus(
                new Map([
                    ['order-1', { status: ExchangeOrderStatus.FILLED }],
                    ['order-2', { status: ExchangeOrderStatus.CANCELED }],
                    ['order-3', { status: ExchangeOrderStatus.FILLED }],
                ]),
            );

            const result = await service.process(dbOrders, []);

            expect(result.filledOrders).toHaveLength(2);
            expect(result.filledOrders).toContainEqual(order1);
            expect(result.filledOrders).toContainEqual(order3);
            expect(result.processed).toBe(3);
            expect(result.filled).toBe(2);
            expect(result.cancelled).toBe(1);
            expect(mockOrderRepository.updateStatus).toHaveBeenCalledTimes(3);
        });

        it('should mark order as missing when not in history', async () => {
            const order1 = createDbOrder('order-1');
            const dbOrders = [order1];

            mockOrderStatus(new Map()); // No statuses found

            const result = await service.process(dbOrders, []);

            expect(result.filledOrders).toHaveLength(0);
            expect(result.processed).toBe(1);
            expect(result.missing).toBe(1);
            expect(mockOrderRepository.updateStatus).toHaveBeenCalledWith(
                order1.id.toString(),
                OrderStatus.Missing,
                undefined,
            );
        });

        it('should mark orders as missing when API fails', async () => {
            const order1 = createDbOrder('order-1');
            const order2 = createDbOrder('order-2');
            const dbOrders = [order1, order2];

            mockOrderClient.getOrderStatus.mockRejectedValue(new Error('API Error'));

            const result = await service.process(dbOrders, []);

            expect(result.filledOrders).toHaveLength(0);
            expect(result.processed).toBe(2);
            expect(result.missing).toBe(2);
            expect(mockOrderRepository.updateStatus).toHaveBeenCalledTimes(2);
            expect(mockOrderRepository.updateStatus).toHaveBeenCalledWith(
                order1.id.toString(),
                OrderStatus.Missing,
                undefined,
            );
        });

        it('should return empty when all orders still open', async () => {
            const order1 = createDbOrder('order-1');
            const dbOrders = [order1];

            const exchangeOrders = [createExchangeOrder('order-1')];

            const result = await service.process(dbOrders, exchangeOrders);

            expect(result.filledOrders).toHaveLength(0);
            expect(result.processed).toBe(0);
            expect(mockOrderClient.getOrderStatus).not.toHaveBeenCalled();
        });

        it('should skip orders without exchange ID', async () => {
            const orderWithoutId = Order.create({
                id: OrderId.create(),
                exchangeOrderId: undefined,
                symbol: Symbol.create('BTC'),
                type: OrderType.Limit,
                side: OrderSide.Buy,
                price: Price.from(50000),
                amount: Decimal.from(0.01),
                status: OrderStatus.Pending,
                gridId: gridId,
                levelIndex: 5,
            });

            const dbOrders = [orderWithoutId];

            const result = await service.process(dbOrders, []);

            expect(result.filledOrders).toHaveLength(0);
            expect(result.processed).toBe(0);
            expect(mockOrderClient.getOrderStatus).not.toHaveBeenCalled();
        });

        it('should return empty for empty input', async () => {
            const result = await service.process([], []);

            expect(result.filledOrders).toHaveLength(0);
            expect(result.processed).toBe(0);
            expect(mockOrderClient.getOrderStatus).not.toHaveBeenCalled();
        });

        it('should detect filled order when not in exchange orders', async () => {
            const order1 = createDbOrder('order-1');
            const dbOrders = [order1];

            mockOrderStatus(new Map([['order-1', { status: ExchangeOrderStatus.FILLED }]]));

            const result = await service.process(dbOrders, []);

            expect(result.filledOrders).toHaveLength(1);
            expect(result.filledOrders).toContainEqual(order1);
            expect(result.processed).toBe(1);
            expect(result.filled).toBe(1);
            expect(mockOrderRepository.updateStatus).toHaveBeenCalledWith(
                order1.id.toString(),
                OrderStatus.Filled,
                expect.any(Date),
            );
        });
    });
});
