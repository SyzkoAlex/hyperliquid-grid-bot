import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncOrdersUseCase } from './sync-orders.use-case';
import { GridMode } from '@domain/models/grid/grid-mode';
import { GridStatus } from '@domain/models/grid/grid-status';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Price } from '@domain/models/primitives/price';
import { Decimal } from '@domain/models/primitives/decimal';
import { OrderType } from '@domain/models/order/order-type';
import { OrderSide } from '@domain/models/order/order-side';
import { OrderStatus } from '@domain/models/order/order-status';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { OrderDto } from '@components/grids/api/dto/order.dto';
import { ExchangeCloid } from '@components/trading/core/domain/models/exchange-order/exchange-cloid';
import { ExchangeOrderStatus } from '@components/trading/core/domain/models/exchange-order/exchange-order-status';

describe('SyncOrdersUseCase', () => {
    let useCase: SyncOrdersUseCase;
    let mockOrderClient: any;
    let mockGrids: any;
    let mockOrderStatusSyncService: any;
    let mockOrderRefillService: any;
    let mockConfigService: any;

    const createTestGrid = (overrides: Partial<GridDto> = {}): GridDto => ({
        id: crypto.randomUUID(),
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
        trailingStepPercent: 2,
        trailingPartialClosePercent: 50,
        ...overrides,
    });

    const createTestOrder = (gridId: string, overrides: Partial<OrderDto> = {}): OrderDto => ({
        id: crypto.randomUUID(),
        gridId,
        symbol: 'BTC',
        type: OrderType.Limit,
        side: OrderSide.Buy,
        price: 50000,
        amount: 0.01,
        status: OrderStatus.Placed,
        levelIndex: 5,
        exchangeOrderId: null,
        createdAt: Date.now(),
        ...overrides,
    });

    beforeEach(() => {
        mockOrderClient = {
            getOpenSpotOrders: vi.fn().mockResolvedValue([]),
            getCurrentPrice: vi.fn().mockResolvedValue(Price.from(50500)),
        };

        mockGrids = {
            findActiveGrids: vi.fn().mockResolvedValue([]),
            findPlacedOrdersByGridIds: vi.fn().mockResolvedValue([]),
        };

        mockOrderStatusSyncService = {
            process: vi.fn().mockResolvedValue({ filled: 0, filledOrders: [] }),
        };

        mockOrderRefillService = {
            processMany: vi.fn().mockResolvedValue(0),
        };

        mockConfigService = {
            get: vi.fn().mockReturnValue({ accountAddress: '0x123' }),
        };

        useCase = new SyncOrdersUseCase(
            mockConfigService,
            mockOrderClient,
            mockGrids,
            mockOrderStatusSyncService,
            mockOrderRefillService,
        );
    });

    describe('execute', () => {
        it('should return empty result when no active grids', async () => {
            mockOrderClient.getOpenSpotOrders.mockResolvedValue([]);
            mockGrids.findActiveGrids.mockResolvedValue([]);

            const result = await useCase.execute();

            expect(result.gridsProcessed).toBe(0);
            expect(result.fillsDetected).toBe(0);
            expect(mockOrderClient.getOpenSpotOrders).toHaveBeenCalledWith('0x123');
            expect(mockGrids.findActiveGrids).toHaveBeenCalled();
        });

        it('should processOne active grids and detect fills', async () => {
            const grid = createTestGrid();
            const orderId = crypto.randomUUID();
            const cloid = ExchangeCloid.create(orderId);

            const order = createTestOrder(grid.id, { id: orderId });

            const exchangeOrder = {
                id: 'exchange-123',
                cloid,
                symbol: TradingSymbol.create('BTC'),
                type: OrderType.Limit,
                side: OrderSide.Buy,
                price: Price.from(50000),
                amount: Decimal.from(0.01),
                status: ExchangeOrderStatus.OPEN,
                reduceOnly: false,
                placedAt: Date.now(),
            };

            mockOrderClient.getOpenSpotOrders.mockResolvedValue([exchangeOrder]);
            mockGrids.findActiveGrids.mockResolvedValue([grid]);
            mockGrids.findPlacedOrdersByGridIds.mockResolvedValue([order]);
            mockOrderStatusSyncService.process.mockResolvedValue({
                filled: 1,
                filledOrders: [order],
            });
            mockOrderRefillService.processMany.mockResolvedValue(1);

            const result = await useCase.execute();

            expect(result.gridsProcessed).toBe(1);
            expect(result.fillsDetected).toBe(1);
            expect(result.refillsPlaced).toBe(1);
            expect(mockOrderStatusSyncService.process).toHaveBeenCalledWith(
                [order],
                [exchangeOrder],
            );
            expect(mockOrderRefillService.processMany).toHaveBeenCalledWith([order], grid);
        });

        it('should skip grids that are not running', async () => {
            const grid = createTestGrid({ status: GridStatus.Idle });
            const orderId = crypto.randomUUID();
            const cloid = ExchangeCloid.create(orderId);

            const order = createTestOrder(grid.id, { id: orderId });

            const exchangeOrder = {
                id: 'exchange-123',
                cloid,
                symbol: TradingSymbol.create('BTC'),
                type: OrderType.Limit,
                side: OrderSide.Buy,
                price: Price.from(50000),
                amount: Decimal.from(0.01),
                status: ExchangeOrderStatus.OPEN,
                reduceOnly: false,
                placedAt: Date.now(),
            };

            mockOrderClient.getOpenSpotOrders.mockResolvedValue([exchangeOrder]);
            mockGrids.findActiveGrids.mockResolvedValue([grid]);
            mockGrids.findPlacedOrdersByGridIds.mockResolvedValue([order]);

            mockOrderStatusSyncService.process.mockResolvedValue({
                filled: 0,
                filledOrders: [],
            });

            const result = await useCase.execute();

            expect(result.gridsProcessed).toBe(1);
            expect(result.fillsDetected).toBe(0);
            expect(mockOrderStatusSyncService.process).toHaveBeenCalledWith(
                [order],
                [exchangeOrder],
            );
        });

        it('should handle errors gracefully and continue processing', async () => {
            const grid1 = createTestGrid();
            const grid2 = createTestGrid();

            const orderId1 = crypto.randomUUID();
            const orderId2 = crypto.randomUUID();
            const cloid1 = ExchangeCloid.create(orderId1);
            const cloid2 = ExchangeCloid.create(orderId2);

            const order1 = createTestOrder(grid1.id, { id: orderId1 });
            const order2 = createTestOrder(grid2.id, { id: orderId2 });

            const exchangeOrder1 = {
                id: 'exchange-123',
                cloid: cloid1,
                symbol: TradingSymbol.create('BTC'),
                type: OrderType.Limit,
                side: OrderSide.Buy,
                price: Price.from(50000),
                amount: Decimal.from(0.01),
                status: ExchangeOrderStatus.OPEN,
                reduceOnly: false,
                placedAt: Date.now(),
            };

            const exchangeOrder2 = {
                id: 'exchange-456',
                cloid: cloid2,
                symbol: TradingSymbol.create('BTC'),
                type: OrderType.Limit,
                side: OrderSide.Buy,
                price: Price.from(50000),
                amount: Decimal.from(0.01),
                status: ExchangeOrderStatus.OPEN,
                reduceOnly: false,
                placedAt: Date.now(),
            };

            mockOrderClient.getOpenSpotOrders.mockResolvedValue([exchangeOrder1, exchangeOrder2]);
            mockGrids.findActiveGrids.mockResolvedValue([grid1, grid2]);
            mockGrids.findPlacedOrdersByGridIds.mockResolvedValue([order1, order2]);
            mockOrderStatusSyncService.process
                .mockRejectedValueOnce(new Error('DB error'))
                .mockResolvedValueOnce({ filled: 0, filledOrders: [] });

            const result = await useCase.execute();

            expect(result.gridsProcessed).toBe(1);
            expect(result.errors.length).toBe(1);
            expect(result.errors[0]).toContain('DB error');
        });

        it('should pass all filled orders to processMany', async () => {
            const grid = createTestGrid();

            const buyOrder1 = createTestOrder(grid.id, { levelIndex: 5 });
            const buyOrder2 = createTestOrder(grid.id, { price: 52000, levelIndex: 7 });

            mockOrderClient.getOpenSpotOrders.mockResolvedValue([]);
            mockGrids.findActiveGrids.mockResolvedValue([grid]);
            mockGrids.findPlacedOrdersByGridIds.mockResolvedValue([buyOrder1, buyOrder2]);
            mockOrderStatusSyncService.process.mockResolvedValue({
                filled: 2,
                filledOrders: [buyOrder1, buyOrder2],
            });
            mockOrderRefillService.processMany.mockResolvedValue(1);

            const result = await useCase.execute();

            expect(mockOrderRefillService.processMany).toHaveBeenCalledWith(
                [buyOrder1, buyOrder2],
                grid,
            );
            expect(result.refillsPlaced).toBe(1);
        });

        it('should count refills correctly', async () => {
            const grid = createTestGrid();

            const orderId = crypto.randomUUID();
            const cloid = ExchangeCloid.create(orderId);

            const order = createTestOrder(grid.id, { id: orderId });

            const exchangeOrder = {
                id: 'exchange-123',
                cloid,
                symbol: TradingSymbol.create('BTC'),
                type: OrderType.Limit,
                side: OrderSide.Buy,
                price: Price.from(50000),
                amount: Decimal.from(0.01),
                status: ExchangeOrderStatus.OPEN,
                reduceOnly: false,
                placedAt: Date.now(),
            };

            const order2 = createTestOrder(grid.id, { levelIndex: 6 });

            mockOrderClient.getOpenSpotOrders.mockResolvedValue([exchangeOrder]);
            mockGrids.findActiveGrids.mockResolvedValue([grid]);
            mockGrids.findPlacedOrdersByGridIds.mockResolvedValue([order, order2]);

            mockOrderStatusSyncService.process.mockResolvedValue({
                filled: 2,
                filledOrders: [order, order2],
            });
            mockOrderRefillService.processMany.mockResolvedValue(1);

            const result = await useCase.execute();

            expect(result.fillsDetected).toBe(2);
            expect(result.refillsPlaced).toBe(1);
        });
    });
});
