import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderStatusSyncService } from './order-status-sync.service';
import { OrderStatus } from '@domain/models/order/order-status';
import { OrderSide } from '@domain/models/order/order-side';
import { OrderType } from '@domain/models/order/order-type';
import { ExchangeOpenOrder } from '@components/trading/core/domain/models/exchange-order/exchange-open-order';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Price } from '@domain/models/primitives/price';
import { Decimal } from '@domain/models/primitives/decimal';
import { ExchangeOrderStatus } from '@components/trading/core/domain/models/exchange-order/exchange-order-status';
import { OrderDto } from '@components/grids/api/dto/order.dto';

const ACCOUNT_ADDRESS = '0x1234567890123456789012345678901234567890';

describe('OrderStatusSyncService', () => {
    let service: OrderStatusSyncService;
    let mockOrderClient: {
        getOrderStatus: ReturnType<typeof vi.fn>;
    };
    let mockOrderRepository: {
        updateOrderStatus: ReturnType<typeof vi.fn>;
    };
    let mockFeeSyncService: {
        syncFee: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        mockOrderClient = {
            getOrderStatus: vi.fn(),
        };

        mockOrderRepository = {
            updateOrderStatus: vi.fn(),
        };

        mockFeeSyncService = {
            syncFee: vi.fn().mockResolvedValue(undefined),
        };

        service = new OrderStatusSyncService(
            mockOrderClient as any,
            mockOrderRepository as any,
            mockFeeSyncService as any,
        );
    });

    describe('process', () => {
        const gridId = '550e8400-e29b-41d4-a716-446655440000';

        const createDbOrder = (exchangeOrderId: string): OrderDto => ({
            id: crypto.randomUUID(),
            gridId,
            symbol: 'BTC',
            type: OrderType.Limit,
            side: OrderSide.Buy,
            price: 50000,
            amount: 0.01,
            status: OrderStatus.Placed,
            levelIndex: 5,
            exchangeOrderId,
            createdAt: Date.now(),
        });

        const createExchangeOrder = (exchangeOrderId: string): ExchangeOpenOrder => ({
            id: exchangeOrderId,
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

            const result = await service.process(dbOrders, [], ACCOUNT_ADDRESS);

            expect(result.filledOrders).toHaveLength(2);
            expect(result.filledOrders).toContainEqual(order1);
            expect(result.filledOrders).toContainEqual(order2);
            expect(result.processed).toBe(2);
            expect(result.filled).toBe(2);
            expect(mockOrderRepository.updateOrderStatus).toHaveBeenCalledTimes(2);
        });

        it('should call syncFee when a fill is detected', async () => {
            const fillTimestamp = Date.now();
            const order = createDbOrder('order-1');
            const dbOrders = [order];

            mockOrderStatus(
                new Map([
                    [
                        'order-1',
                        { status: ExchangeOrderStatus.FILLED, statusTimestamp: fillTimestamp },
                    ],
                ]),
            );

            await service.process(dbOrders, [], ACCOUNT_ADDRESS);

            expect(mockFeeSyncService.syncFee).toHaveBeenCalledWith(
                order.id,
                order.exchangeOrderId,
                fillTimestamp,
                ACCOUNT_ADDRESS,
            );
        });

        it('should not call syncFee for cancelled orders', async () => {
            const order = createDbOrder('order-1');
            const dbOrders = [order];

            mockOrderStatus(new Map([['order-1', { status: ExchangeOrderStatus.CANCELED }]]));

            await service.process(dbOrders, [], ACCOUNT_ADDRESS);

            expect(mockFeeSyncService.syncFee).not.toHaveBeenCalled();
        });

        it('should handle cancelled orders but not return them', async () => {
            const order1 = createDbOrder('order-1');
            const dbOrders = [order1];

            mockOrderStatus(new Map([['order-1', { status: ExchangeOrderStatus.CANCELED }]]));

            const result = await service.process(dbOrders, [], ACCOUNT_ADDRESS);

            expect(result.filledOrders).toHaveLength(0);
            expect(result.processed).toBe(1);
            expect(result.cancelled).toBe(1);
            expect(mockOrderRepository.updateOrderStatus).toHaveBeenCalledWith(
                order1.id,
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

            const result = await service.process(dbOrders, [], ACCOUNT_ADDRESS);

            expect(result.filledOrders).toHaveLength(2);
            expect(result.filledOrders).toContainEqual(order1);
            expect(result.filledOrders).toContainEqual(order3);
            expect(result.processed).toBe(3);
            expect(result.filled).toBe(2);
            expect(result.cancelled).toBe(1);
            expect(mockOrderRepository.updateOrderStatus).toHaveBeenCalledTimes(3);
        });

        it('should mark order as missing when not in history', async () => {
            const order1 = createDbOrder('order-1');
            const dbOrders = [order1];

            mockOrderStatus(new Map());

            const result = await service.process(dbOrders, [], ACCOUNT_ADDRESS);

            expect(result.filledOrders).toHaveLength(0);
            expect(result.processed).toBe(1);
            expect(result.missing).toBe(1);
            expect(mockOrderRepository.updateOrderStatus).toHaveBeenCalledWith(
                order1.id,
                OrderStatus.Missing,
                undefined,
            );
        });

        it('should skip orders when API fails instead of marking as missing', async () => {
            const order1 = createDbOrder('order-1');
            const order2 = createDbOrder('order-2');
            const dbOrders = [order1, order2];

            mockOrderClient.getOrderStatus.mockRejectedValue(new Error('API Error'));

            const result = await service.process(dbOrders, [], ACCOUNT_ADDRESS);

            expect(result.filledOrders).toHaveLength(0);
            expect(result.processed).toBe(0);
            expect(result.missing).toBe(0);
            expect(mockOrderRepository.updateOrderStatus).not.toHaveBeenCalled();
        });

        it('should skip errored orders while processing successful ones', async () => {
            const order1 = createDbOrder('order-1');
            const order2 = createDbOrder('order-2');
            const dbOrders = [order1, order2];

            mockOrderClient.getOrderStatus.mockImplementation(
                async (_user: string, oid: string) => {
                    if (oid === 'order-1') {
                        return createHistoryRecord(oid, ExchangeOrderStatus.FILLED);
                    }
                    throw new Error('Network error');
                },
            );

            const result = await service.process(dbOrders, [], ACCOUNT_ADDRESS);

            expect(result.filledOrders).toHaveLength(1);
            expect(result.filledOrders).toContainEqual(order1);
            expect(result.processed).toBe(1);
            expect(result.filled).toBe(1);
            expect(result.missing).toBe(0);
            expect(mockOrderRepository.updateOrderStatus).toHaveBeenCalledTimes(1);
            expect(mockOrderRepository.updateOrderStatus).toHaveBeenCalledWith(
                order1.id,
                OrderStatus.Filled,
                expect.any(Date),
            );
        });

        it('should return empty when all orders still open', async () => {
            const order1 = createDbOrder('order-1');
            const dbOrders = [order1];

            const exchangeOrders = [createExchangeOrder('order-1')];

            const result = await service.process(dbOrders, exchangeOrders, ACCOUNT_ADDRESS);

            expect(result.filledOrders).toHaveLength(0);
            expect(result.processed).toBe(0);
            expect(mockOrderClient.getOrderStatus).not.toHaveBeenCalled();
        });

        it('should skip orders without exchange ID', async () => {
            const orderWithoutId: OrderDto = {
                id: crypto.randomUUID(),
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
            };

            const dbOrders = [orderWithoutId];

            const result = await service.process(dbOrders, [], ACCOUNT_ADDRESS);

            expect(result.filledOrders).toHaveLength(0);
            expect(result.processed).toBe(0);
            expect(mockOrderClient.getOrderStatus).not.toHaveBeenCalled();
        });

        it('should return empty for empty input', async () => {
            const result = await service.process([], [], ACCOUNT_ADDRESS);

            expect(result.filledOrders).toHaveLength(0);
            expect(result.processed).toBe(0);
            expect(mockOrderClient.getOrderStatus).not.toHaveBeenCalled();
        });

        it('should detect filled order when not in exchange orders', async () => {
            const order1 = createDbOrder('order-1');
            const dbOrders = [order1];

            mockOrderStatus(new Map([['order-1', { status: ExchangeOrderStatus.FILLED }]]));

            const result = await service.process(dbOrders, [], ACCOUNT_ADDRESS);

            expect(result.filledOrders).toHaveLength(1);
            expect(result.filledOrders).toContainEqual(order1);
            expect(result.processed).toBe(1);
            expect(result.filled).toBe(1);
            expect(mockOrderRepository.updateOrderStatus).toHaveBeenCalledWith(
                order1.id,
                OrderStatus.Filled,
                expect.any(Date),
            );
        });
    });
});
