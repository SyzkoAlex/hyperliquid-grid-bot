import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StpRecoveryService } from './stp-recovery.service';
import { GridStatus } from '@domain/models/grid/grid-status';
import { OrderSide } from '@domain/models/order/order-side';
import { OrderType } from '@domain/models/order/order-type';
import { OrderStatus } from '@domain/models/order/order-status';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { OrderDto } from '@components/grids/api/dto/order.dto';
import { PlaceRefillOrderResult } from '../refill-order-placement/place-refill-order-result';

const ACCOUNT_ADDRESS = '0x1234567890123456789012345678901234567890';
const GRID_ID = '550e8400-e29b-41d4-a716-446655440000';

const createGrid = (overrides: Partial<GridDto> = {}): GridDto => ({
    id: GRID_ID,
    userId: 'user-1',
    symbol: 'BTC',
    status: GridStatus.Running,
    lowerPrice: 45000,
    upperPrice: 55000,
    levels: 11,
    investmentUSDC: 5000,
    investmentBase: 0.1,
    trailingEnabled: false,
    trailingTriggerPercent: 5,
    trailingStepPercent: 2,
    trailingPartialClosePercent: 50,
    stopLossEnabled: false,
    ...overrides,
});

const createOrder = (overrides: Partial<OrderDto> = {}): OrderDto => ({
    id: crypto.randomUUID(),
    gridId: GRID_ID,
    symbol: 'BTC',
    type: OrderType.Limit,
    side: OrderSide.Buy,
    price: 50000,
    amount: 0.01,
    status: OrderStatus.Cancelled,
    levelIndex: 5,
    exchangeOrderId: '123',
    createdAt: Date.now(),
    ...overrides,
});

describe('StpRecoveryService', () => {
    let sut: StpRecoveryService;
    let mockGrids: {
        findActiveOrdersByGridId: ReturnType<typeof vi.fn>;
    };
    let mockRefillPlacement: {
        placeRefillOrder: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        mockGrids = {
            findActiveOrdersByGridId: vi.fn().mockResolvedValue([]),
        };

        mockRefillPlacement = {
            placeRefillOrder: vi
                .fn()
                .mockResolvedValue(PlaceRefillOrderResult.success(createOrder())),
        };

        sut = new StpRecoveryService(mockGrids as any, mockRefillPlacement as any);
    });

    describe('recoverMany', () => {
        it('should return 0 when grid is not running', async () => {
            const grid = createGrid({ status: GridStatus.Stopped });
            const stpOrder = createOrder();

            const result = await sut.recoverMany([stpOrder], grid, ACCOUNT_ADDRESS);

            expect(result).toBe(0);
            expect(mockRefillPlacement.placeRefillOrder).not.toHaveBeenCalled();
        });

        it('should return 0 for empty stpOrders list', async () => {
            const grid = createGrid();

            const result = await sut.recoverMany([], grid, ACCOUNT_ADDRESS);

            expect(result).toBe(0);
            expect(mockRefillPlacement.placeRefillOrder).not.toHaveBeenCalled();
        });

        it('should skip order when conflicting order exists on opposite side at same level', async () => {
            const grid = createGrid();
            const stpOrder = createOrder({ side: OrderSide.Buy, levelIndex: 5 });
            const conflictingOrder = createOrder({ side: OrderSide.Sell, levelIndex: 5 });

            mockGrids.findActiveOrdersByGridId.mockResolvedValue([conflictingOrder]);

            const result = await sut.recoverMany([stpOrder], grid, ACCOUNT_ADDRESS);

            expect(result).toBe(0);
            expect(mockRefillPlacement.placeRefillOrder).not.toHaveBeenCalled();
        });

        it('should not skip when conflicting order is on the same side at same level', async () => {
            const grid = createGrid();
            const stpOrder = createOrder({ side: OrderSide.Buy, levelIndex: 5 });
            const sameSideOrder = createOrder({ side: OrderSide.Buy, levelIndex: 5 });

            mockGrids.findActiveOrdersByGridId.mockResolvedValue([sameSideOrder]);

            const result = await sut.recoverMany([stpOrder], grid, ACCOUNT_ADDRESS);

            expect(result).toBe(1);
            expect(mockRefillPlacement.placeRefillOrder).toHaveBeenCalledOnce();
        });

        it('should call placeRefillOrder with correct RefillParams (same side, level, price, amount)', async () => {
            const grid = createGrid();
            const stpOrder = createOrder({
                side: OrderSide.Sell,
                levelIndex: 7,
                price: 52000,
                amount: 0.02,
            });

            const result = await sut.recoverMany([stpOrder], grid, ACCOUNT_ADDRESS);

            expect(result).toBe(1);
            expect(mockRefillPlacement.placeRefillOrder).toHaveBeenCalledWith(
                grid,
                expect.objectContaining({
                    side: OrderSide.Sell,
                    levelIndex: 7,
                }),
                ACCOUNT_ADDRESS,
            );
        });

        it('should return the number of successfully recovered orders', async () => {
            const grid = createGrid();
            const stpOrder1 = createOrder({ levelIndex: 3, price: 47000 });
            const stpOrder2 = createOrder({ levelIndex: 7, price: 52000 });

            mockRefillPlacement.placeRefillOrder
                .mockResolvedValueOnce(PlaceRefillOrderResult.success(createOrder()))
                .mockResolvedValueOnce(PlaceRefillOrderResult.success(createOrder()));

            const result = await sut.recoverMany([stpOrder1, stpOrder2], grid, ACCOUNT_ADDRESS);

            expect(result).toBe(2);
            expect(mockRefillPlacement.placeRefillOrder).toHaveBeenCalledTimes(2);
        });

        it('should count only successful recoveries when one fails', async () => {
            const grid = createGrid();
            const stpOrder1 = createOrder({ levelIndex: 3, price: 47000 });
            const stpOrder2 = createOrder({ levelIndex: 7, price: 52000 });

            mockRefillPlacement.placeRefillOrder
                .mockResolvedValueOnce(PlaceRefillOrderResult.success(createOrder()))
                .mockResolvedValueOnce(PlaceRefillOrderResult.failure('Insufficient balance'));

            const result = await sut.recoverMany([stpOrder1, stpOrder2], grid, ACCOUNT_ADDRESS);

            expect(result).toBe(1);
        });

        it('should not throw when placeRefillOrder throws and should continue processing', async () => {
            const grid = createGrid();
            const stpOrder1 = createOrder({ levelIndex: 3, price: 47000 });
            const stpOrder2 = createOrder({ levelIndex: 7, price: 52000 });

            mockRefillPlacement.placeRefillOrder
                .mockRejectedValueOnce(new Error('Network error'))
                .mockResolvedValueOnce(PlaceRefillOrderResult.success(createOrder()));

            const result = await sut.recoverMany([stpOrder1, stpOrder2], grid, ACCOUNT_ADDRESS);

            expect(result).toBe(1);
            expect(mockRefillPlacement.placeRefillOrder).toHaveBeenCalledTimes(2);
        });

        it('should not skip when conflicting order is at a different level', async () => {
            const grid = createGrid();
            const stpOrder = createOrder({ side: OrderSide.Buy, levelIndex: 5 });
            const differentLevelOrder = createOrder({ side: OrderSide.Sell, levelIndex: 6 });

            mockGrids.findActiveOrdersByGridId.mockResolvedValue([differentLevelOrder]);

            const result = await sut.recoverMany([stpOrder], grid, ACCOUNT_ADDRESS);

            expect(result).toBe(1);
        });
    });
});
