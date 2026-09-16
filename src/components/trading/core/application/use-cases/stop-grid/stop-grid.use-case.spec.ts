import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StopGridUseCase } from './stop-grid.use-case';
import { GridStatus } from '@domain/models/grid/grid-status';
import { Price } from '@domain/models/primitives/price';
import { OrderStatus } from '@domain/models/order/order-status';
import { OrderSide } from '@domain/models/order/order-side';
import { OrderType } from '@domain/models/order/order-type';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { OrderDto } from '@components/grids/api/dto/order.dto';

function makeGrid(overrides: Partial<GridDto> = {}): GridDto {
    return {
        id: 'grid-1',
        userId: 'user-1',
        symbol: 'ETH',
        status: GridStatus.Running,
        lowerPrice: 2000,
        upperPrice: 3000,
        orderCount: 10,
        investmentUSDC: 1000,
        investmentBase: 0,
        trailingEnabled: false,
        trailingTriggerPercent: 5,
        trailingStepPercent: 2,
        trailingPartialClosePercent: 50,
        stopLossEnabled: false,
        ...overrides,
    };
}

function makeOrder(overrides: Partial<OrderDto> = {}): OrderDto {
    return {
        id: 'order-1',
        gridId: 'grid-1',
        symbol: 'ETH',
        side: OrderSide.Buy,
        status: OrderStatus.Placed,
        type: OrderType.Limit,
        orderIndex: 0,
        price: 2500,
        amount: 0.1,
        exchangeOrderId: 'exch-1',
        createdAt: Date.now(),
        ...overrides,
    };
}

describe('StopGridUseCase', () => {
    let sut: StopGridUseCase;
    let mockGrids: {
        findGridById: ReturnType<typeof vi.fn>;
        findActiveOrdersByGridId: ReturnType<typeof vi.fn>;
        markStopped: ReturnType<typeof vi.fn>;
        updateOrderStatus: ReturnType<typeof vi.fn>;
    };
    let mockExchange: {
        getCurrentPrice: ReturnType<typeof vi.fn>;
        cancelSpotOrder: ReturnType<typeof vi.fn>;
    };

    const accountAddress = '0xabc';

    beforeEach(() => {
        mockGrids = {
            findGridById: vi.fn().mockResolvedValue(makeGrid()),
            findActiveOrdersByGridId: vi.fn().mockResolvedValue([]),
            markStopped: vi.fn().mockResolvedValue(undefined),
            updateOrderStatus: vi.fn().mockResolvedValue(undefined),
        };
        mockExchange = {
            getCurrentPrice: vi.fn().mockResolvedValue(Price.from(2600)),
            cancelSpotOrder: vi.fn().mockResolvedValue({ success: true }),
        };

        sut = new StopGridUseCase(mockGrids as any, mockExchange as any);
    });

    describe('execute — grid not found', () => {
        it('returns without calling markStopped when grid does not exist', async () => {
            mockGrids.findGridById.mockResolvedValue(null);

            await sut.execute('missing-grid', accountAddress);

            expect(mockGrids.markStopped).not.toHaveBeenCalled();
        });
    });

    describe('execute — happy path', () => {
        it('fetches current price and calls markStopped with it', async () => {
            await sut.execute('grid-1', accountAddress);

            expect(mockExchange.getCurrentPrice).toHaveBeenCalledOnce();
            expect(mockGrids.markStopped).toHaveBeenCalledWith('grid-1', 2600);
        });

        it('marks the grid stopped before loading and cancelling active orders', async () => {
            const order = makeOrder({ exchangeOrderId: 'exch-1' });
            mockGrids.findActiveOrdersByGridId.mockResolvedValue([order]);

            await sut.execute('grid-1', accountAddress);

            const markStopped = mockGrids.markStopped.mock.invocationCallOrder[0];
            const loadOrders = mockGrids.findActiveOrdersByGridId.mock.invocationCallOrder[0];
            const cancelOrder = mockExchange.cancelSpotOrder.mock.invocationCallOrder[0];
            expect(markStopped).toBeLessThan(loadOrders);
            expect(loadOrders).toBeLessThan(cancelOrder);
        });

        it('marks orders as cancelled when no exchangeOrderId', async () => {
            const order = makeOrder({ exchangeOrderId: null });
            mockGrids.findActiveOrdersByGridId.mockResolvedValue([order]);

            await sut.execute('grid-1', accountAddress);

            expect(mockGrids.updateOrderStatus).toHaveBeenCalledWith(
                order.id,
                OrderStatus.Cancelled,
            );
            expect(mockExchange.cancelSpotOrder).not.toHaveBeenCalled();
        });

        it('calls markStopped even when there are no active orders', async () => {
            mockGrids.findActiveOrdersByGridId.mockResolvedValue([]);

            await sut.execute('grid-1', accountAddress);

            expect(mockGrids.markStopped).toHaveBeenCalledWith('grid-1', 2600);
        });
    });

    describe('execute — retry of an interrupted stop', () => {
        it('cancels the orders of an already stopped grid without marking it stopped again', async () => {
            const order = makeOrder({ exchangeOrderId: 'exch-1' });
            mockGrids.findGridById.mockResolvedValue(makeGrid({ status: GridStatus.Stopped }));
            mockGrids.findActiveOrdersByGridId.mockResolvedValue([order]);

            await sut.execute('grid-1', accountAddress);

            expect(mockGrids.markStopped).not.toHaveBeenCalled();
            expect(mockExchange.cancelSpotOrder).toHaveBeenCalledOnce();
            expect(mockGrids.updateOrderStatus).toHaveBeenCalledWith(
                order.id,
                OrderStatus.Cancelled,
            );
        });

        it('cancels the orders left over by a stop that failed mid-loop', async () => {
            const first = makeOrder({ id: 'order-1' });
            const second = makeOrder({ id: 'order-2' });
            mockGrids.findActiveOrdersByGridId.mockResolvedValue([first, second]);
            mockGrids.updateOrderStatus.mockRejectedValueOnce(new Error('db unavailable'));

            await expect(sut.execute('grid-1', accountAddress)).rejects.toThrow('db unavailable');

            mockGrids.findGridById.mockResolvedValue(makeGrid({ status: GridStatus.Stopped }));
            mockGrids.findActiveOrdersByGridId.mockResolvedValue([second]);
            await sut.execute('grid-1', accountAddress);

            expect(mockGrids.markStopped).toHaveBeenCalledOnce();
            expect(mockGrids.updateOrderStatus).toHaveBeenLastCalledWith(
                second.id,
                OrderStatus.Cancelled,
            );
        });
    });

    describe('execute — price fetch failure', () => {
        it('calls markStopped with undefined when getCurrentPrice throws', async () => {
            mockExchange.getCurrentPrice.mockRejectedValue(new Error('network error'));

            await sut.execute('grid-1', accountAddress);

            expect(mockGrids.markStopped).toHaveBeenCalledWith('grid-1', undefined);
        });

        it('does not rethrow when getCurrentPrice throws', async () => {
            mockExchange.getCurrentPrice.mockRejectedValue(new Error('network error'));

            await expect(sut.execute('grid-1', accountAddress)).resolves.not.toThrow();
        });
    });
});
