import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LeftoverOrderSweepService } from './leftover-order-sweep.service';
import { GridStatus } from '@domain/models/grid/grid-status';
import { OrderSide } from '@domain/models/order/order-side';
import { OrderStatus } from '@domain/models/order/order-status';
import { OrderType } from '@domain/models/order/order-type';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { OrderDto } from '@components/grids/api/dto/order.dto';
import { GridsApiPort } from '@components/grids/api/grids-api.port';
import { OrderCancellationService } from '../order-cancellation/order-cancellation.service';

const USER_ID = 'user-1';
const ACCOUNT_ADDRESS = '0xabc';
const GRID_ID = 'grid-1';

const createGrid = (overrides: Partial<GridDto> = {}): GridDto => ({
    id: GRID_ID,
    userId: USER_ID,
    symbol: 'ETH',
    status: GridStatus.Stopped,
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
});

const createOrder = (overrides: Partial<OrderDto> = {}): OrderDto => ({
    id: 'order-1',
    gridId: GRID_ID,
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

describe('LeftoverOrderSweepService', () => {
    let sut: LeftoverOrderSweepService;
    let mockGrids: {
        findOrdersByStatus: ReturnType<typeof vi.fn>;
        findGridById: ReturnType<typeof vi.fn>;
    };
    let mockOrderCancellation: { cancelOrder: ReturnType<typeof vi.fn> };

    const givenActiveOrders = (placed: OrderDto[], pending: OrderDto[] = []): void => {
        mockGrids.findOrdersByStatus.mockImplementation(async (status: OrderStatus) =>
            status === OrderStatus.Placed ? placed : pending,
        );
    };

    beforeEach(() => {
        mockGrids = {
            findOrdersByStatus: vi.fn().mockResolvedValue([]),
            findGridById: vi.fn().mockResolvedValue(createGrid()),
        };
        mockOrderCancellation = { cancelOrder: vi.fn().mockResolvedValue(undefined) };

        sut = new LeftoverOrderSweepService(
            mockGrids as unknown as GridsApiPort,
            mockOrderCancellation as unknown as OrderCancellationService,
        );
    });

    it('cancels a leftover order of a stopped grid', async () => {
        const order = createOrder();
        givenActiveOrders([order]);

        const cancelled = await sut.sweep(ACCOUNT_ADDRESS, USER_ID);

        expect(cancelled).toBe(1);
        expect(mockOrderCancellation.cancelOrder).toHaveBeenCalledWith(order, ACCOUNT_ADDRESS);
    });

    it('leaves a pending order of a stopped grid to the order restore', async () => {
        const pending = createOrder({ id: 'order-2', status: OrderStatus.Pending });
        givenActiveOrders([], [pending]);

        const cancelled = await sut.sweep(ACCOUNT_ADDRESS, USER_ID);

        expect(cancelled).toBe(0);
        expect(mockOrderCancellation.cancelOrder).not.toHaveBeenCalled();
    });

    it('leaves the orders of a running grid alone', async () => {
        givenActiveOrders([createOrder()]);
        mockGrids.findGridById.mockResolvedValue(createGrid({ status: GridStatus.Running }));

        const cancelled = await sut.sweep(ACCOUNT_ADDRESS, USER_ID);

        expect(cancelled).toBe(0);
        expect(mockOrderCancellation.cancelOrder).not.toHaveBeenCalled();
    });

    it.each([GridStatus.Idle, GridStatus.Paused])(
        'leaves the orders of a %s grid alone',
        async (status) => {
            givenActiveOrders([createOrder()]);
            mockGrids.findGridById.mockResolvedValue(createGrid({ status }));

            const cancelled = await sut.sweep(ACCOUNT_ADDRESS, USER_ID);

            expect(cancelled).toBe(0);
            expect(mockOrderCancellation.cancelOrder).not.toHaveBeenCalled();
        },
    );

    it('leaves the orders of another user alone', async () => {
        givenActiveOrders([createOrder()]);
        mockGrids.findGridById.mockResolvedValue(createGrid({ userId: 'user-2' }));

        const cancelled = await sut.sweep(ACCOUNT_ADDRESS, USER_ID);

        expect(cancelled).toBe(0);
        expect(mockOrderCancellation.cancelOrder).not.toHaveBeenCalled();
    });

    it('keeps sweeping after a cancellation failure and does not count it', async () => {
        const first = createOrder({ id: 'order-1' });
        const second = createOrder({ id: 'order-2', orderIndex: 1 });
        givenActiveOrders([first, second]);
        mockOrderCancellation.cancelOrder.mockRejectedValueOnce(new Error('db unavailable'));

        const cancelled = await sut.sweep(ACCOUNT_ADDRESS, USER_ID);

        expect(cancelled).toBe(1);
        expect(mockOrderCancellation.cancelOrder).toHaveBeenCalledTimes(2);
        expect(mockOrderCancellation.cancelOrder).toHaveBeenLastCalledWith(second, ACCOUNT_ADDRESS);
    });

    it('reads each grid once for all of its orders', async () => {
        givenActiveOrders([createOrder({ id: 'order-1' }), createOrder({ id: 'order-2' })]);

        await sut.sweep(ACCOUNT_ADDRESS, USER_ID);

        expect(mockGrids.findGridById).toHaveBeenCalledOnce();
    });

    it('does nothing when no orders are active', async () => {
        const cancelled = await sut.sweep(ACCOUNT_ADDRESS, USER_ID);

        expect(cancelled).toBe(0);
        expect(mockGrids.findGridById).not.toHaveBeenCalled();
    });
});
