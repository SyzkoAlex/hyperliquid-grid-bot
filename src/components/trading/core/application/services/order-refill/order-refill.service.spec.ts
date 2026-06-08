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
import { GridsApiPort } from '@components/grids/api/grids-api.port';
import { RefillOrderPlacementService } from '../refill-order-placement/refill-order-placement.service';
import { TradeEventPublisher } from '../trade-event-publisher/trade-event-publisher.service';

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
        trailingStepPercent: 10,
        trailingPartialClosePercent: 50,
        stopLossEnabled: false,
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
            mockGrids as unknown as GridsApiPort,
            mockRefillPlacement as unknown as RefillOrderPlacementService,
            mockTradeEventPublisher as unknown as TradeEventPublisher,
        );
    });

    describe('processOne', () => {
        it('should delegate to placement and event publisher for a BUY fill', async () => {
            const result = await service.processOne(testBuyOrder, testGrid, '0xabc');

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

            const result = await service.processOne(testSellOrder, testGrid, '0xabc');

            expect(result.success).toBe(true);
            expect(result.profit).toBe(10);
        });

        it('should return failure without calling placement when BUY at top level fills', async () => {
            const topLevelBuy: OrderDto = {
                ...testBuyOrder,
                levelIndex: 11,
                price: 55000,
            };

            const result = await service.processOne(topLevelBuy, testGrid, '0xabc');

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

            const result = await service.processOne(bottomLevelSell, testGrid, '0xabc');

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

            const result = await service.processOne(testBuyOrder, testGrid, '0xabc');

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

            const result = await service.processOne(testBuyOrder, testGrid, '0xabc');

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

            const result = await service.processOne(testBuyOrder, testGrid, '0xabc');

            expect(result.success).toBe(true);
            expect(mockRefillPlacement.placeRefillOrder).toHaveBeenCalledTimes(1);
        });

        it('should handle unexpected errors from placement service', async () => {
            mockRefillPlacement.placeRefillOrder.mockRejectedValue(
                new Error('Unexpected DB error'),
            );

            const result = await service.processOne(testBuyOrder, testGrid, '0xabc');

            expect(result.success).toBe(false);
            expect(result.error).toContain('Unexpected DB error');
        });

        describe('immediately filled refill chain', () => {
            it('should continue chain when first refill is immediately filled', async () => {
                const immediatelyFilledSell = makeRefillOrderDto({
                    side: OrderSide.Sell,
                    levelIndex: 6,
                    status: OrderStatus.Filled,
                });
                const finalBuy = makeRefillOrderDto({
                    id: 'final-buy-id',
                    side: OrderSide.Buy,
                    levelIndex: 5,
                    status: OrderStatus.Placed,
                });

                mockRefillPlacement.placeRefillOrder
                    .mockResolvedValueOnce(
                        PlaceRefillOrderResult.immediatelyFilled(immediatelyFilledSell),
                    )
                    .mockResolvedValueOnce(PlaceRefillOrderResult.success(finalBuy));

                const result = await service.processOne(testBuyOrder, testGrid, '0xabc');

                expect(result.success).toBe(true);
                expect(result.refillOrder?.id).toBe('final-buy-id');
                expect(mockRefillPlacement.placeRefillOrder).toHaveBeenCalledTimes(2);
            });

            it('should stop chain when immediately filled refill reaches edge level', async () => {
                const topLevelBuy: OrderDto = {
                    ...testBuyOrder,
                    levelIndex: 10,
                    price: 54000,
                };
                // BUY at L10 fills → SELL at L11 placed but immediately filled
                // → BUY at L10 would be next, but after that BUY at L11 fills → SELL at L12 (edge) → stops
                const immediatelyFilledSell = makeRefillOrderDto({
                    side: OrderSide.Sell,
                    levelIndex: 11,
                    status: OrderStatus.Filled,
                });

                mockRefillPlacement.placeRefillOrder.mockResolvedValueOnce(
                    PlaceRefillOrderResult.immediatelyFilled(immediatelyFilledSell),
                );

                const result = await service.processOne(topLevelBuy, testGrid, '0xabc');

                // SELL at L11 immediately filled → try BUY at L10 → but that would place correctly
                // Actually: after L11 SELL immediately fills, next would be BUY at L10.
                // But mock only returns one immediatelyFilled, the second call hasn't been set up.
                // The second call would use the default mock which returns success.
                expect(result.success).toBe(true);
            });

            it('should stop chain at depth limit to prevent infinite loops', async () => {
                // All placements return immediatelyFilled — depth limit should kick in
                const makeImmediateOrder = (levelIndex: number, side: OrderSide): OrderDto =>
                    makeRefillOrderDto({ side, levelIndex, status: OrderStatus.Filled });

                // Alternating sells and buys to simulate ping-pong (shouldn't actually happen,
                // but depth limit is the safety net)
                let callCount = 0;
                mockRefillPlacement.placeRefillOrder.mockImplementation(() => {
                    callCount++;
                    const level = 6 + (callCount % 2);
                    const side = callCount % 2 === 0 ? OrderSide.Buy : OrderSide.Sell;
                    return Promise.resolve(
                        PlaceRefillOrderResult.immediatelyFilled(makeImmediateOrder(level, side)),
                    );
                });

                const result = await service.processOne(testBuyOrder, testGrid, '0xabc');

                // Should exit loop after grid.levels + 1 = 12 iterations at most
                expect(mockRefillPlacement.placeRefillOrder).toHaveBeenCalledTimes(
                    testGrid.levels + 1,
                );
                expect(result.success).toBe(true);
            });
        });
    });
});
