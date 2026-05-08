import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StopLossOrderCancellationService } from './stop-loss-order-cancellation.service';
import { OrderStatus } from '@domain/models/order/order-status';

const makeOrder = (overrides = {}) => ({
    id: 'order-1',
    gridId: 'grid-1',
    symbol: 'ETH',
    side: 'buy' as const,
    status: OrderStatus.Placed,
    type: 'limit' as const,
    levelIndex: 0,
    price: 2000,
    amount: 0.05,
    exchangeOrderId: 'ex-1',
    createdAt: Date.now(),
    ...overrides,
});

describe('StopLossOrderCancellationService', () => {
    let sut: StopLossOrderCancellationService;
    let mockGrids: {
        findActiveOrdersByGridId: ReturnType<typeof vi.fn>;
        updateOrderStatus: ReturnType<typeof vi.fn>;
    };
    let mockExchange: {
        cancelSpotOrder: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        mockGrids = {
            findActiveOrdersByGridId: vi.fn().mockResolvedValue([makeOrder()]),
            updateOrderStatus: vi.fn().mockResolvedValue(undefined),
        };
        mockExchange = {
            cancelSpotOrder: vi.fn().mockResolvedValue({ success: true }),
        };

        sut = new StopLossOrderCancellationService(mockGrids as any, mockExchange as any);
    });

    describe('cancelActiveOrders', () => {
        it('fetches active orders and cancels each on exchange and in DB', async () => {
            const result = await sut.cancelActiveOrders('grid-1', '0xabc');

            expect(mockGrids.findActiveOrdersByGridId).toHaveBeenCalledWith('grid-1');
            expect(mockExchange.cancelSpotOrder).toHaveBeenCalledOnce();
            expect(mockGrids.updateOrderStatus).toHaveBeenCalledWith(
                'order-1',
                OrderStatus.Cancelled,
            );
            expect(result.cancelledCount).toBe(1);
            expect(result.failedCount).toBe(0);
        });

        it('skips exchange cancel and updates DB directly for orders without exchangeOrderId', async () => {
            mockGrids.findActiveOrdersByGridId.mockResolvedValue([
                makeOrder({ exchangeOrderId: null }),
            ]);

            const result = await sut.cancelActiveOrders('grid-1', '0xabc');

            expect(mockExchange.cancelSpotOrder).not.toHaveBeenCalled();
            expect(mockGrids.updateOrderStatus).toHaveBeenCalledWith(
                'order-1',
                OrderStatus.Cancelled,
            );
            expect(result.cancelledCount).toBe(1);
            expect(result.failedCount).toBe(0);
        });

        it('does not update DB order status when exchange cancel throws', async () => {
            mockExchange.cancelSpotOrder.mockRejectedValue(new Error('Exchange unreachable'));

            const result = await sut.cancelActiveOrders('grid-1', '0xabc');

            expect(mockGrids.updateOrderStatus).not.toHaveBeenCalled();
            expect(result.cancelledCount).toBe(0);
            expect(result.failedCount).toBe(1);
        });

        it('does nothing when there are no active orders', async () => {
            mockGrids.findActiveOrdersByGridId.mockResolvedValue([]);

            const result = await sut.cancelActiveOrders('grid-1', '0xabc');

            expect(mockExchange.cancelSpotOrder).not.toHaveBeenCalled();
            expect(mockGrids.updateOrderStatus).not.toHaveBeenCalled();
            expect(result.cancelledCount).toBe(0);
            expect(result.failedCount).toBe(0);
        });

        it('cancels all orders when multiple active orders exist', async () => {
            mockGrids.findActiveOrdersByGridId.mockResolvedValue([
                makeOrder({ id: 'order-1', exchangeOrderId: 'ex-1' }),
                makeOrder({ id: 'order-2', exchangeOrderId: 'ex-2' }),
                makeOrder({ id: 'order-3', exchangeOrderId: 'ex-3' }),
            ]);

            const result = await sut.cancelActiveOrders('grid-1', '0xabc');

            expect(mockExchange.cancelSpotOrder).toHaveBeenCalledTimes(3);
            expect(mockGrids.updateOrderStatus).toHaveBeenCalledTimes(3);
            expect(result.cancelledCount).toBe(3);
            expect(result.failedCount).toBe(0);
        });

        it('continues cancelling remaining orders when one exchange cancel throws', async () => {
            mockGrids.findActiveOrdersByGridId.mockResolvedValue([
                makeOrder({ id: 'order-1', exchangeOrderId: 'ex-1' }),
                makeOrder({ id: 'order-2', exchangeOrderId: 'ex-2' }),
            ]);
            mockExchange.cancelSpotOrder
                .mockRejectedValueOnce(new Error('Exchange unreachable'))
                .mockResolvedValueOnce({ success: true });

            const result = await sut.cancelActiveOrders('grid-1', '0xabc');

            expect(mockExchange.cancelSpotOrder).toHaveBeenCalledTimes(2);
            // Only order-2 DB status updated (order-1 failed on exchange)
            expect(mockGrids.updateOrderStatus).toHaveBeenCalledTimes(1);
            expect(mockGrids.updateOrderStatus).toHaveBeenCalledWith(
                'order-2',
                OrderStatus.Cancelled,
            );
            expect(result.cancelledCount).toBe(1);
            expect(result.failedCount).toBe(1);
        });
    });
});
