import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderCancellationService } from './order-cancellation.service';
import { OrderStatus } from '@domain/models/order/order-status';
import { OrderSide } from '@domain/models/order/order-side';
import { OrderType } from '@domain/models/order/order-type';
import { GridsApiPort } from '@components/grids/api/grids-api.port';
import { ExchangePort } from '@components/trading/core/application/ports/exchange.port';
import { OrderDto } from '@components/grids/api/dto/order.dto';

const ACCOUNT_ADDRESS = '0xabc';

const createOrder = (overrides: Partial<OrderDto> = {}): OrderDto => ({
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
});

describe('OrderCancellationService', () => {
    let sut: OrderCancellationService;
    let mockGrids: { updateOrderStatus: ReturnType<typeof vi.fn> };
    let mockExchange: { cancelSpotOrder: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        mockGrids = { updateOrderStatus: vi.fn().mockResolvedValue(undefined) };
        mockExchange = { cancelSpotOrder: vi.fn().mockResolvedValue({ success: true }) };

        sut = new OrderCancellationService(
            mockGrids as unknown as GridsApiPort,
            mockExchange as unknown as ExchangePort,
        );
    });

    it('cancels the order on the exchange and marks it cancelled in the DB', async () => {
        const order = createOrder();

        await sut.cancelOrder(order, ACCOUNT_ADDRESS);

        expect(mockExchange.cancelSpotOrder).toHaveBeenCalledWith(
            expect.objectContaining({ exchangeOrderId: 'exch-1', accountAddress: ACCOUNT_ADDRESS }),
        );
        expect(mockGrids.updateOrderStatus).toHaveBeenCalledWith(order.id, OrderStatus.Cancelled);
    });

    it('marks an order without an exchangeOrderId cancelled without calling the exchange', async () => {
        const order = createOrder({ exchangeOrderId: null });

        await sut.cancelOrder(order, ACCOUNT_ADDRESS);

        expect(mockExchange.cancelSpotOrder).not.toHaveBeenCalled();
        expect(mockGrids.updateOrderStatus).toHaveBeenCalledWith(order.id, OrderStatus.Cancelled);
    });

    it('marks the order cancelled when the exchange rejects the cancel', async () => {
        mockExchange.cancelSpotOrder.mockResolvedValue({ success: false, error: 'unknown order' });

        await sut.cancelOrder(createOrder(), ACCOUNT_ADDRESS);

        expect(mockGrids.updateOrderStatus).toHaveBeenCalledWith('order-1', OrderStatus.Cancelled);
    });

    it('marks the order cancelled when the exchange call throws', async () => {
        mockExchange.cancelSpotOrder.mockRejectedValue(new Error('Network error'));

        await expect(sut.cancelOrder(createOrder(), ACCOUNT_ADDRESS)).resolves.toBeUndefined();

        expect(mockGrids.updateOrderStatus).toHaveBeenCalledWith('order-1', OrderStatus.Cancelled);
    });
});
