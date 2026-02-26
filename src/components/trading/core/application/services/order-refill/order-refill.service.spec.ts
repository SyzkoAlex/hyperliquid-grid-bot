import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderRefillService } from './order-refill.service';
import { OrderType } from '@domain/models/order/order-type';
import { OrderSide } from '@domain/models/order/order-side';
import { OrderStatus } from '@domain/models/order/order-status';
import { GridMode } from '@domain/models/grid/grid-mode';
import { GridStatus } from '@domain/models/grid/grid-status';
import { Decimal } from '@domain/models/primitives/decimal';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { OrderDto } from '@components/grids/api/dto/order.dto';

const GRID_ID = '550e8400-e29b-41d4-a716-446655440000';
const REFILL_ORDER_ID = '880e8400-e29b-41d4-a716-446655440003';

describe('OrderRefillService', () => {
    let service: OrderRefillService;
    let mockOrderClient: {
        placeSpotOrder: ReturnType<typeof vi.fn>;
    };
    let mockOrderRepository: {
        createOrder: ReturnType<typeof vi.fn>;
        updateOrderExchangeId: ReturnType<typeof vi.fn>;
        updateOrderStatus: ReturnType<typeof vi.fn>;
    };
    let mockEventBus: {
        publish: ReturnType<typeof vi.fn>;
    };

    // Test grid: 11 levels, spacing = (55000-45000)/(11-1) = 1000
    const testGrid: GridDto = {
        id: GRID_ID,
        symbol: 'BTC',
        mode: GridMode.Neutral,
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

    // Test buy order at level 5 (middle of grid)
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
    };

    // Test sell order at level 6
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
    };

    const makeRefillOrderDto = (overrides: Partial<OrderDto> = {}): OrderDto => ({
        id: REFILL_ORDER_ID,
        gridId: GRID_ID,
        symbol: 'BTC',
        side: OrderSide.Sell,
        status: OrderStatus.Pending,
        type: OrderType.Limit,
        levelIndex: 6,
        price: 51000,
        amount: 0.01,
        exchangeOrderId: null,
        ...overrides,
    });

    beforeEach(() => {
        mockOrderClient = {
            placeSpotOrder: vi.fn().mockResolvedValue({
                exchangeOrderId: 'default-order-id',
                status: OrderStatus.Placed,
            }),
        };

        mockOrderRepository = {
            createOrder: vi.fn().mockResolvedValue(makeRefillOrderDto()),
            updateOrderExchangeId: vi.fn().mockResolvedValue(undefined),
            updateOrderStatus: vi.fn().mockResolvedValue(undefined),
        };

        mockEventBus = {
            publish: vi.fn(),
        };

        const mockProfitCalculator = {
            calculate: vi
                .fn()
                .mockImplementation(
                    (amount: number, upperPrice: number, lowerPrice: number, levels: number) => {
                        const spacing = (upperPrice - lowerPrice) / (levels - 1);
                        return Decimal.from(spacing * amount);
                    },
                ),
        };

        service = new OrderRefillService(
            mockOrderClient as any,
            mockOrderRepository as any,
            mockEventBus as any,
            mockProfitCalculator as any,
        );
    });

    describe('processFilledOrder', () => {
        it('should place SELL order one level up when BUY order fills', async () => {
            mockOrderClient.placeSpotOrder.mockResolvedValue({
                exchangeOrderId: 'new-order-111',
                status: OrderStatus.Placed,
            });

            const result = await service.processOne(testBuyOrder, testGrid);

            // Should succeed
            expect(result.success).toBe(true);
            expect(result.refillOrder).toBeDefined();

            // Should place SELL order at level 6 (one up from level 5)
            expect(mockOrderClient.placeSpotOrder).toHaveBeenCalledWith(
                expect.objectContaining({
                    side: OrderSide.Sell,
                }),
            );

            // Pre-save pattern: order saved with pending status
            expect(mockOrderRepository.createOrder).toHaveBeenCalledTimes(1);

            // Then exchangeOrderId updated after successful placement
            expect(mockOrderRepository.updateOrderExchangeId).toHaveBeenCalledWith(
                expect.any(String),
                'new-order-111',
                OrderStatus.Placed,
                expect.any(Date),
            );

            // Should NOT calculate profit (buy order)
            expect(result.profit).toBeUndefined();

            // Should publish OrderOpenedEvent
            expect(mockEventBus.publish).toHaveBeenCalled();
        });

        it('should place BUY order one level down when SELL order fills', async () => {
            mockOrderRepository.createOrder.mockResolvedValue(
                makeRefillOrderDto({ side: OrderSide.Buy }),
            );
            mockOrderClient.placeSpotOrder.mockResolvedValue({
                exchangeOrderId: 'new-order-222',
                status: OrderStatus.Placed,
            });

            const result = await service.processOne(testSellOrder, testGrid);

            // Should succeed
            expect(result.success).toBe(true);
            expect(result.refillOrder).toBeDefined();

            // Should place BUY order at level 5 (one down from level 6)
            expect(mockOrderClient.placeSpotOrder).toHaveBeenCalledWith(
                expect.objectContaining({
                    side: OrderSide.Buy,
                }),
            );

            // Pre-save pattern: order saved with pending status
            expect(mockOrderRepository.createOrder).toHaveBeenCalledTimes(1);

            // Then exchangeOrderId updated after successful placement
            expect(mockOrderRepository.updateOrderExchangeId).toHaveBeenCalledWith(
                expect.any(String),
                'new-order-222',
                OrderStatus.Placed,
                expect.any(Date),
            );

            // Should calculate profit (sell order)
            expect(result.profit).toBeDefined();
            expect(result.profit).toBeGreaterThan(0);
        });

        it('should not place refill when BUY order at top level fills', async () => {
            const filledBuyOrder: OrderDto = {
                id: '990e8400-e29b-41d4-a716-446655440004',
                gridId: GRID_ID,
                symbol: 'BTC',
                side: OrderSide.Buy,
                status: OrderStatus.Filled,
                type: OrderType.Limit,
                levelIndex: 10, // Top level (last level in 11-level grid)
                price: 55000,
                amount: 0.01,
                exchangeOrderId: 'exchange-top',
            };

            const result = await service.processOne(filledBuyOrder, testGrid);

            // Should fail (no refill at edge)
            expect(result.success).toBe(false);
            expect(result.error).toContain('Edge level');

            // Should NOT place order
            expect(mockOrderClient.placeSpotOrder).not.toHaveBeenCalled();
        });

        it('should not place refill when SELL order at bottom level fills', async () => {
            const filledSellOrder: OrderDto = {
                id: 'aa0e8400-e29b-41d4-a716-446655440005',
                gridId: GRID_ID,
                symbol: 'BTC',
                side: OrderSide.Sell,
                status: OrderStatus.Filled,
                type: OrderType.Limit,
                levelIndex: 0, // Bottom level
                price: 45000,
                amount: 0.01,
                exchangeOrderId: 'exchange-bottom',
            };

            const result = await service.processOne(filledSellOrder, testGrid);

            // Should fail (no refill at edge)
            expect(result.success).toBe(false);
            expect(result.error).toContain('Edge level');

            // Should NOT place order
            expect(mockOrderClient.placeSpotOrder).not.toHaveBeenCalled();
        });

        it('should handle order placement failure gracefully', async () => {
            mockOrderClient.placeSpotOrder.mockResolvedValue({
                exchangeOrderId: null,
                status: OrderStatus.Failed,
                error: 'Insufficient balance',
            });

            const result = await service.processOne(testBuyOrder, testGrid);

            // Should fail
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();

            // With pre-save pattern: order IS saved with pending status
            expect(mockOrderRepository.createOrder).toHaveBeenCalledTimes(1);

            // Then status updated to failed
            expect(mockOrderRepository.updateOrderStatus).toHaveBeenCalledWith(
                expect.any(String),
                OrderStatus.Failed,
            );
        });

        it('should calculate correct profit for sell orders', async () => {
            mockOrderRepository.createOrder.mockResolvedValue(
                makeRefillOrderDto({ side: OrderSide.Buy }),
            );
            mockOrderClient.placeSpotOrder.mockResolvedValue({
                exchangeOrderId: 'new-order-333',
                status: OrderStatus.Placed,
            });

            const result = await service.processOne(testSellOrder, testGrid);

            // Grid spacing = (55000 - 45000) / 10 = 1000
            // Profit = spacing * amount = 1000 * 0.01 = 10
            expect(result.profit).toBe(10);
        });
    });
});
