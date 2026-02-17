import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderRefillService } from './order-refill.service';
import { Order } from '@domain/order/order';
import { OrderId } from '@domain/order/order-id';
import { OrderType } from '@domain/order/order-type';
import { OrderSide } from '@domain/order/order-side';
import { OrderStatus } from '@domain/order/order-status';
import { Grid } from '@domain/grid/grid';
import { GridId } from '@domain/grid/grid-id';
import { GridMode } from '@domain/grid/grid-mode';
import { TradingSymbol } from '@domain/primitives/trading-symbol';
import { Price } from '@domain/primitives/price';
import { Decimal } from '../../../../../domain/primitives/decimal';

describe('OrderRefillService', () => {
    let service: OrderRefillService;
    let mockOrderClient: {
        placeSpotOrder: ReturnType<typeof vi.fn>;
    };
    let mockOrderRepository: {
        save: ReturnType<typeof vi.fn>;
        updateExchangeOrderId: ReturnType<typeof vi.fn>;
        updateStatus: ReturnType<typeof vi.fn>;
    };
    let mockEventBus: {
        publish: ReturnType<typeof vi.fn>;
    };

    // Test grid configuration
    const createTestGrid = (): Grid => {
        return Grid.create({
            symbol: TradingSymbol.create('BTC'),
            mode: GridMode.Neutral,
            lowerPrice: Price.from(45000),
            upperPrice: Price.from(55000),
            levels: 11, // 11 levels = 10 intervals, spacing = 1000
            investmentUSDC: Decimal.from(5000),
            investmentBase: Decimal.from(0.1),
        });
    };

    // Test order at level 5 (middle of grid)
    const createTestBuyOrder = (): Order =>
        Order.create({
            id: OrderId.create(),
            gridId: GridId.from('550e8400-e29b-41d4-a716-446655440000'),
            exchangeOrderId: 'exchange-789',
            symbol: TradingSymbol.create('BTC'),
            type: OrderType.Limit,
            price: Price.from(50000), // Level 5
            levelIndex: 5,
            side: OrderSide.Buy,
            amount: Decimal.from(0.01),
            status: OrderStatus.Placed,
        });

    const createTestSellOrder = (): Order =>
        Order.create({
            id: OrderId.create(),
            gridId: GridId.from('550e8400-e29b-41d4-a716-446655440000'),
            exchangeOrderId: 'exchange-012',
            symbol: TradingSymbol.create('BTC'),
            type: OrderType.Limit,
            price: Price.from(51000), // Level 6
            levelIndex: 6,
            side: OrderSide.Sell,
            amount: Decimal.from(0.01),
            status: OrderStatus.Placed,
        });

    beforeEach(() => {
        mockOrderClient = {
            placeSpotOrder: vi.fn().mockResolvedValue({
                exchangeOrderId: 'default-order-id',
                status: OrderStatus.Placed,
            }),
        };

        mockOrderRepository = {
            save: vi.fn().mockResolvedValue(undefined),
            updateExchangeOrderId: vi.fn().mockResolvedValue(undefined),
            updateStatus: vi.fn().mockResolvedValue(undefined),
        };

        mockEventBus = {
            publish: vi.fn(),
        };

        const mockProfitCalculator = {
            calculate: vi.fn().mockImplementation((order: Order, grid: Grid) => {
                if (order.side === OrderSide.Sell) {
                    const spacing = grid.getGridSpacing().toNumber();
                    return Decimal.from(spacing * order.amount.toNumber());
                }
                return null;
            }),
        };

        // Create service with mocks directly via constructor
        service = new OrderRefillService(
            mockOrderClient as any,
            mockOrderRepository as any,
            mockEventBus as any,
            mockProfitCalculator as any,
        );
    });

    describe('processFilledOrder', () => {
        it('should place SELL order one level up when BUY order fills', async () => {
            const grid = createTestGrid();
            const filledBuyOrder = createTestBuyOrder();

            mockOrderClient.placeSpotOrder.mockResolvedValue({
                exchangeOrderId: 'new-order-111',
                status: OrderStatus.Placed,
            });

            const result = await service.processOne(filledBuyOrder, grid);

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
            expect(mockOrderRepository.save).toHaveBeenCalledTimes(1);

            // Then exchangeOrderId updated after successful placement
            expect(mockOrderRepository.updateExchangeOrderId).toHaveBeenCalledWith(
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
            const grid = createTestGrid();
            const filledSellOrder = createTestSellOrder();

            mockOrderClient.placeSpotOrder.mockResolvedValue({
                exchangeOrderId: 'new-order-222',
                status: OrderStatus.Placed,
            });

            const result = await service.processOne(filledSellOrder, grid);

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
            expect(mockOrderRepository.save).toHaveBeenCalledTimes(1);

            // Then exchangeOrderId updated after successful placement
            expect(mockOrderRepository.updateExchangeOrderId).toHaveBeenCalledWith(
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
            const grid = createTestGrid();
            const filledBuyOrder = Order.create({
                id: OrderId.create(),
                gridId: GridId.from('550e8400-e29b-41d4-a716-446655440000'),
                exchangeOrderId: 'exchange-top',
                symbol: TradingSymbol.create('BTC'),
                type: OrderType.Limit,
                price: Price.from(55000),
                levelIndex: 10, // Top level (last level in 11-level grid)
                side: OrderSide.Buy,
                amount: Decimal.from(0.01),
                status: OrderStatus.Filled,
            });

            const result = await service.processOne(filledBuyOrder, grid);

            // Should fail (no refill at edge)
            expect(result.success).toBe(false);
            expect(result.error).toContain('Edge level');

            // Should NOT place order
            expect(mockOrderClient.placeSpotOrder).not.toHaveBeenCalled();
        });

        it('should not place refill when SELL order at bottom level fills', async () => {
            const grid = createTestGrid();
            const filledSellOrder = Order.create({
                id: OrderId.create(),
                gridId: GridId.from('550e8400-e29b-41d4-a716-446655440000'),
                exchangeOrderId: 'exchange-bottom',
                symbol: TradingSymbol.create('BTC'),
                type: OrderType.Limit,
                price: Price.from(45000),
                levelIndex: 0, // Bottom level
                side: OrderSide.Sell,
                amount: Decimal.from(0.01),
                status: OrderStatus.Filled,
            });

            const result = await service.processOne(filledSellOrder, grid);

            // Should fail (no refill at edge)
            expect(result.success).toBe(false);
            expect(result.error).toContain('Edge level');

            // Should NOT place order
            expect(mockOrderClient.placeSpotOrder).not.toHaveBeenCalled();
        });

        it('should handle order placement failure gracefully', async () => {
            const grid = createTestGrid();
            const filledBuyOrder = createTestBuyOrder();

            mockOrderClient.placeSpotOrder.mockResolvedValue({
                exchangeOrderId: null,
                status: OrderStatus.Failed,
                error: 'Insufficient balance',
            });

            const result = await service.processOne(filledBuyOrder, grid);

            // Should fail
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();

            // With pre-save pattern: order IS saved with pending status
            expect(mockOrderRepository.save).toHaveBeenCalledTimes(1);

            // Then status updated to failed
            expect(mockOrderRepository.updateStatus).toHaveBeenCalledWith(
                expect.any(String),
                OrderStatus.Failed,
            );
        });

        it('should calculate correct profit for sell orders', async () => {
            const grid = createTestGrid();
            const filledSellOrder = createTestSellOrder();

            mockOrderClient.placeSpotOrder.mockResolvedValue({
                exchangeOrderId: 'new-order-333',
                status: OrderStatus.Placed,
            });

            const result = await service.processOne(filledSellOrder, grid);

            // Grid spacing = (55000 - 45000) / 10 = 1000
            // Profit = spacing * amount = 1000 * 0.01 = 10
            expect(result.profit).toBe(10);
        });
    });
});
