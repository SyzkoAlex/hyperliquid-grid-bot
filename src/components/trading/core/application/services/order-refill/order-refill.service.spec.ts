import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderRefillService } from './order-refill.service';
import { OrderType } from '@domain/models/order/order-type';
import { OrderSide } from '@domain/models/order/order-side';
import { OrderStatus } from '@domain/models/order/order-status';
import { GridStatus } from '@domain/models/grid/grid-status';
import { Decimal } from '@domain/models/primitives/decimal';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { OrderDto } from '@components/grids/api/dto/order.dto';
import { PlaceRefillOrderResult } from '../refill-order-placement/place-refill-order-result';

const GRID_ID = '550e8400-e29b-41d4-a716-446655440000';
const REFILL_ORDER_ID = '880e8400-e29b-41d4-a716-446655440003';

describe('OrderRefillService', () => {
    let service: OrderRefillService;
    let mockGrids: {
        findActiveOrdersByGridId: ReturnType<typeof vi.fn>;
    };
    let mockRefillPlacement: {
        placeRefillOrder: ReturnType<typeof vi.fn>;
    };
    let mockTradeEventPublisher: {
        publishFillEvent: ReturnType<typeof vi.fn>;
    };

    // Grid: 11 gaps → 12 price points (indices 0..11), spacing = (55000-45000)/11 ≈ 909
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
    };

    const testBuyOrder: OrderDto = {
        id: '660e8400-e29b-41d4-a716-446655440001',
        gridId: GRID_ID,
        symbol: 'BTC',
        side: OrderSide.Buy,
        status: OrderStatus.Placed,
        type: OrderType.Limit,
        levelIndex: 5,
        price: 50000,
        amount: 0.01,
        exchangeOrderId: 'exchange-789',
        createdAt: Date.now(),
    };

    const testSellOrder: OrderDto = {
        id: '770e8400-e29b-41d4-a716-446655440002',
        gridId: GRID_ID,
        symbol: 'BTC',
        side: OrderSide.Sell,
        status: OrderStatus.Placed,
        type: OrderType.Limit,
        levelIndex: 6,
        price: 51000,
        amount: 0.01,
        exchangeOrderId: 'exchange-012',
        createdAt: Date.now(),
    };

    const makeRefillOrderDto = (overrides: Partial<OrderDto> = {}): OrderDto => ({
        id: REFILL_ORDER_ID,
        gridId: GRID_ID,
        symbol: 'BTC',
        side: OrderSide.Sell,
        status: OrderStatus.Placed,
        type: OrderType.Limit,
        levelIndex: 6,
        price: 51000,
        amount: 0.01,
        exchangeOrderId: 'exchange-placed',
        createdAt: Date.now(),
        ...overrides,
    });

    beforeEach(() => {
        mockGrids = {
            findActiveOrdersByGridId: vi.fn().mockResolvedValue([]),
        };

        mockRefillPlacement = {
            placeRefillOrder: vi
                .fn()
                .mockResolvedValue(PlaceRefillOrderResult.success(makeRefillOrderDto())),
        };

        mockTradeEventPublisher = {
            publishFillEvent: vi.fn().mockResolvedValue(null),
        };

        service = new OrderRefillService(
            mockGrids as any,
            mockRefillPlacement as any,
            mockTradeEventPublisher as any,
        );
    });

    describe('processOne', () => {
        it('should delegate to placement and event publisher for a BUY fill', async () => {
            const result = await service.processOne(testBuyOrder, testGrid);

            expect(result.success).toBe(true);
            expect(result.refillOrder).toBeDefined();
            expect(result.profit).toBeUndefined();

            expect(mockRefillPlacement.placeRefillOrder).toHaveBeenCalledTimes(1);
            expect(mockTradeEventPublisher.publishFillEvent).toHaveBeenCalledWith(
                testBuyOrder,
                testGrid,
            );
        });

        it('should return profit from event publisher for a SELL fill', async () => {
            mockTradeEventPublisher.publishFillEvent.mockResolvedValue(Decimal.from(10));
            mockRefillPlacement.placeRefillOrder.mockResolvedValue(
                PlaceRefillOrderResult.success(makeRefillOrderDto({ side: OrderSide.Buy })),
            );

            const result = await service.processOne(testSellOrder, testGrid);

            expect(result.success).toBe(true);
            expect(result.profit).toBe(10);
        });

        it('should return failure without calling placement when BUY at top level fills', async () => {
            const topLevelBuy: OrderDto = {
                ...testBuyOrder,
                levelIndex: 11,
                price: 55000,
            };

            const result = await service.processOne(topLevelBuy, testGrid);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Edge level');
            expect(mockRefillPlacement.placeRefillOrder).not.toHaveBeenCalled();
            expect(mockTradeEventPublisher.publishFillEvent).toHaveBeenCalledWith(
                topLevelBuy,
                testGrid,
            );
        });

        it('should return failure without calling placement when SELL at bottom level fills', async () => {
            const bottomLevelSell: OrderDto = {
                ...testSellOrder,
                levelIndex: 0,
                price: 45000,
            };

            const result = await service.processOne(bottomLevelSell, testGrid);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Edge level');
            expect(mockRefillPlacement.placeRefillOrder).not.toHaveBeenCalled();
            expect(mockTradeEventPublisher.publishFillEvent).toHaveBeenCalledWith(
                bottomLevelSell,
                testGrid,
            );
        });

        it('should return failure when placement fails', async () => {
            mockRefillPlacement.placeRefillOrder.mockResolvedValue(
                PlaceRefillOrderResult.failure('Insufficient balance'),
            );

            const result = await service.processOne(testBuyOrder, testGrid);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Insufficient balance');
            expect(mockTradeEventPublisher.publishFillEvent).toHaveBeenCalledWith(
                testBuyOrder,
                testGrid,
            );
        });

        it('should skip refill when active order already exists at target level', async () => {
            mockGrids.findActiveOrdersByGridId.mockResolvedValue([
                makeRefillOrderDto({
                    levelIndex: 6,
                    side: OrderSide.Sell,
                    status: OrderStatus.Placed,
                }),
            ]);

            const result = await service.processOne(testBuyOrder, testGrid);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Active order already exists');
            expect(mockRefillPlacement.placeRefillOrder).not.toHaveBeenCalled();
            expect(mockTradeEventPublisher.publishFillEvent).toHaveBeenCalledWith(
                testBuyOrder,
                testGrid,
            );
        });

        it('should still attempt refill when publishFillEvent throws', async () => {
            mockTradeEventPublisher.publishFillEvent.mockRejectedValue(new Error('Event bus down'));

            const result = await service.processOne(testBuyOrder, testGrid);

            expect(result.success).toBe(true);
            expect(mockRefillPlacement.placeRefillOrder).toHaveBeenCalledTimes(1);
        });

        it('should handle unexpected errors from placement service', async () => {
            mockRefillPlacement.placeRefillOrder.mockRejectedValue(
                new Error('Unexpected DB error'),
            );

            const result = await service.processOne(testBuyOrder, testGrid);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Unexpected DB error');
        });
    });
});
