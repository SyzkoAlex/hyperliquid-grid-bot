import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RefillOrderPlacementService } from './refill-order-placement.service';
import { OrderType } from '@domain/models/order/order-type';
import { OrderSide } from '@domain/models/order/order-side';
import { OrderStatus } from '@domain/models/order/order-status';
import { GridStatus } from '@domain/models/grid/grid-status';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { OrderDto } from '@components/grids/api/dto/order.dto';
import { RefillParams } from '../order-refill/refill-params';
import { Price } from '@domain/models/primitives/price';
import { Decimal } from '@domain/models/primitives/decimal';
import { DuplicateActiveOrderError } from '@components/grids/api/errors/duplicate-active-order.error';

const GRID_ID = '550e8400-e29b-41d4-a716-446655440000';
const PENDING_ORDER_ID = '880e8400-e29b-41d4-a716-446655440003';

describe('RefillOrderPlacementService', () => {
    let service: RefillOrderPlacementService;
    let mockExchange: { placeSpotOrder: ReturnType<typeof vi.fn> };
    let mockGrids: {
        createOrder: ReturnType<typeof vi.fn>;
        updateOrderExchangeId: ReturnType<typeof vi.fn>;
        updateOrderStatus: ReturnType<typeof vi.fn>;
    };

    const testGrid: GridDto = {
        id: GRID_ID,
        symbol: 'BTC',
        status: GridStatus.Running,
        lowerPrice: 45000,
        upperPrice: 55000,
        levels: 11,
        investmentUSDC: 5000,
        investmentBase: 0.1,
        trailingEnabled: false,
        trailingTriggerPercent: 5,
        trailingStepPercent: 10,
        trailingPartialClosePercent: 50,
        stopLossEnabled: false,
    };

    const testParams = new RefillParams(OrderSide.Sell, 6, Price.from(51000), Decimal.from(0.01));

    const makePendingOrder = (overrides: Partial<OrderDto> = {}): OrderDto => ({
        id: PENDING_ORDER_ID,
        gridId: GRID_ID,
        symbol: 'BTC',
        side: OrderSide.Sell,
        status: OrderStatus.Pending,
        type: OrderType.Limit,
        levelIndex: 6,
        price: 51000,
        amount: 0.01,
        exchangeOrderId: null,
        createdAt: Date.now(),
        ...overrides,
    });

    beforeEach(() => {
        mockExchange = {
            placeSpotOrder: vi.fn().mockResolvedValue({
                exchangeOrderId: 'exchange-111',
                status: OrderStatus.Placed,
            }),
        };

        mockGrids = {
            createOrder: vi.fn().mockResolvedValue(makePendingOrder()),
            updateOrderExchangeId: vi.fn().mockResolvedValue(undefined),
            updateOrderStatus: vi.fn().mockResolvedValue(undefined),
        };

        service = new RefillOrderPlacementService(mockExchange as any, mockGrids as any);
    });

    it('should create pending order, place on exchange, and update with exchangeOrderId', async () => {
        const result = await service.placeRefillOrder(testGrid, testParams, '0xabc');

        expect(result.success).toBe(true);
        expect(result.order).toBeDefined();
        expect(result.order!.id).toBe(PENDING_ORDER_ID);

        expect(mockGrids.createOrder).toHaveBeenCalledTimes(1);
        expect(mockGrids.createOrder).toHaveBeenCalledWith(
            expect.objectContaining({
                gridId: GRID_ID,
                side: OrderSide.Sell,
                levelIndex: 6,
            }),
        );

        expect(mockExchange.placeSpotOrder).toHaveBeenCalledTimes(1);
        expect(mockExchange.placeSpotOrder).toHaveBeenCalledWith(
            expect.objectContaining({ side: OrderSide.Sell, accountAddress: '0xabc' }),
        );

        expect(mockGrids.updateOrderExchangeId).toHaveBeenCalledWith(
            PENDING_ORDER_ID,
            'exchange-111',
            OrderStatus.Placed,
            expect.any(Date),
        );
    });

    it('should return failure and mark order as failed when exchange returns failed status', async () => {
        mockExchange.placeSpotOrder.mockResolvedValue({
            exchangeOrderId: null,
            status: OrderStatus.Failed,
            error: 'Insufficient balance',
        });

        const result = await service.placeRefillOrder(testGrid, testParams, '0xabc');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Insufficient balance');

        expect(mockGrids.updateOrderStatus).toHaveBeenCalledWith(
            PENDING_ORDER_ID,
            OrderStatus.Failed,
        );
        expect(mockGrids.updateOrderExchangeId).not.toHaveBeenCalled();
    });

    it('should cleanup pending order and rethrow when exchange throws', async () => {
        mockExchange.placeSpotOrder.mockRejectedValue(new Error('Network timeout'));

        await expect(service.placeRefillOrder(testGrid, testParams, '0xabc')).rejects.toThrow(
            'Network timeout',
        );

        expect(mockGrids.updateOrderStatus).toHaveBeenCalledWith(
            PENDING_ORDER_ID,
            OrderStatus.Failed,
        );
    });

    it('should return failure without rethrowing when DuplicateActiveOrderError is thrown', async () => {
        mockGrids.createOrder.mockRejectedValue(new DuplicateActiveOrderError(GRID_ID, 6, 'sell'));

        const result = await service.placeRefillOrder(testGrid, testParams, '0xabc');

        expect(result.success).toBe(false);
        expect(result.error).toContain('Duplicate');
        expect(mockExchange.placeSpotOrder).not.toHaveBeenCalled();
    });
});
