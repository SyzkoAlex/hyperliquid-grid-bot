import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncOrdersUseCase } from './sync-orders.use-case';
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
import { ExchangePort } from '@components/trading/core/application/ports/exchange.port';
import { GridsApiPort } from '@components/grids/api/grids-api.port';
import { OrderStatusSyncService } from '@components/trading/core/application/services/order-status-sync/order-status-sync.service';
import { OrderRefillService } from '@components/trading/core/application/services/order-refill/order-refill.service';
import { StpRecoveryService } from '@components/trading/core/application/services/stp-recovery/stp-recovery.service';
import { StopLossMonitorService } from '@components/trading/core/application/services/stop-loss-monitor/stop-loss-monitor.service';
import { TriggerStopLossUseCase } from '@components/trading/core/application/use-cases/trigger-stop-loss/trigger-stop-loss.use-case';
import { StopLossWatchDecision } from '@components/trading/core/domain/services/stop-loss-watcher/types/stop-loss-watch-decision';

describe('SyncOrdersUseCase', () => {
    let useCase: SyncOrdersUseCase;
    let mockOrderClient: { getOpenSpotOrders: ReturnType<typeof vi.fn> };
    let mockGrids: {
        findActiveGridsByUserId: ReturnType<typeof vi.fn>;
        findPlacedOrdersByGridIds: ReturnType<typeof vi.fn>;
    };
    let mockOrderStatusSyncService: { process: ReturnType<typeof vi.fn> };
    let mockOrderRefillService: { processMany: ReturnType<typeof vi.fn> };
    let mockStpRecoveryService: { recoverMany: ReturnType<typeof vi.fn> };
    let mockStopLossMonitor: { evaluateGrid: ReturnType<typeof vi.fn> };
    let mockTriggerStopLoss: { execute: ReturnType<typeof vi.fn> };

    const createTestGrid = (overrides: Partial<GridDto> = {}): GridDto => ({
        id: crypto.randomUUID(),
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
        };

        mockGrids = {
            findActiveGridsByUserId: vi.fn().mockResolvedValue([]),
            findPlacedOrdersByGridIds: vi.fn().mockResolvedValue([]),
        };

        mockOrderStatusSyncService = {
            process: vi
                .fn()
                .mockResolvedValue({ filled: 0, filledOrders: [], stpCancelledOrders: [] }),
        };

        mockOrderRefillService = {
            processMany: vi.fn().mockResolvedValue(0),
        };

        mockStpRecoveryService = {
            recoverMany: vi.fn().mockResolvedValue(0),
        };

        mockStopLossMonitor = {
            evaluateGrid: vi.fn().mockReturnValue(StopLossWatchDecision.NoBreach),
        };

        mockTriggerStopLoss = {
            execute: vi
                .fn()
                .mockResolvedValue({ success: true, soldBaseAmount: 0, receivedUSDC: 0 }),
        };

        useCase = new SyncOrdersUseCase(
            mockOrderClient as unknown as ExchangePort,
            mockGrids as unknown as GridsApiPort,
            mockOrderStatusSyncService as unknown as OrderStatusSyncService,
            mockOrderRefillService as unknown as OrderRefillService,
            mockStpRecoveryService as unknown as StpRecoveryService,
            mockStopLossMonitor as unknown as StopLossMonitorService,
            mockTriggerStopLoss as unknown as TriggerStopLossUseCase,
        );
    });

    describe('execute', () => {
        it('should return empty result when no active grids', async () => {
            mockOrderClient.getOpenSpotOrders.mockResolvedValue([]);
            mockGrids.findActiveGridsByUserId.mockResolvedValue([]);

            const result = await useCase.execute('0x123', 'user-uuid-1');

            expect(result.gridsProcessed).toBe(0);
            expect(result.fillsDetected).toBe(0);
            expect(mockOrderClient.getOpenSpotOrders).toHaveBeenCalledWith('0x123');
            expect(mockGrids.findActiveGridsByUserId).toHaveBeenCalledWith('user-uuid-1');
        });

        it('should process one active grid and detect fills', async () => {
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
            mockGrids.findActiveGridsByUserId.mockResolvedValue([grid]);
            mockGrids.findPlacedOrdersByGridIds.mockResolvedValue([order]);
            mockOrderStatusSyncService.process.mockResolvedValue({
                filled: 1,
                filledOrders: [order],
                stpCancelledOrders: [],
            });
            mockOrderRefillService.processMany.mockResolvedValue(1);

            const result = await useCase.execute('0x123', 'user-uuid-1');

            expect(result.gridsProcessed).toBe(1);
            expect(result.fillsDetected).toBe(1);
            expect(result.refillsPlaced).toBe(1);
            expect(mockOrderStatusSyncService.process).toHaveBeenCalledWith(
                [order],
                [exchangeOrder],
                '0x123',
            );
            expect(mockOrderRefillService.processMany).toHaveBeenCalledWith([order], grid, '0x123');
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
            mockGrids.findActiveGridsByUserId.mockResolvedValue([grid]);
            mockGrids.findPlacedOrdersByGridIds.mockResolvedValue([order]);

            mockOrderStatusSyncService.process.mockResolvedValue({
                filled: 0,
                filledOrders: [],
                stpCancelledOrders: [],
            });

            const result = await useCase.execute('0x123', 'user-uuid-1');

            expect(result.gridsProcessed).toBe(1);
            expect(result.fillsDetected).toBe(0);
            expect(mockOrderStatusSyncService.process).toHaveBeenCalledWith(
                [order],
                [exchangeOrder],
                '0x123',
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
            mockGrids.findActiveGridsByUserId.mockResolvedValue([grid1, grid2]);
            mockGrids.findPlacedOrdersByGridIds.mockResolvedValue([order1, order2]);
            mockOrderStatusSyncService.process
                .mockRejectedValueOnce(new Error('DB error'))
                .mockResolvedValueOnce({ filled: 0, filledOrders: [], stpCancelledOrders: [] });

            const result = await useCase.execute('0x123', 'user-uuid-1');

            expect(result.gridsProcessed).toBe(1);
            expect(result.errors.length).toBe(1);
            expect(result.errors[0]).toContain('DB error');
        });

        it('should pass all filled orders to processMany', async () => {
            const grid = createTestGrid();

            const buyOrder1 = createTestOrder(grid.id, { levelIndex: 5 });
            const buyOrder2 = createTestOrder(grid.id, { price: 52000, levelIndex: 7 });

            mockOrderClient.getOpenSpotOrders.mockResolvedValue([]);
            mockGrids.findActiveGridsByUserId.mockResolvedValue([grid]);
            mockGrids.findPlacedOrdersByGridIds.mockResolvedValue([buyOrder1, buyOrder2]);
            mockOrderStatusSyncService.process.mockResolvedValue({
                filled: 2,
                filledOrders: [buyOrder1, buyOrder2],
                stpCancelledOrders: [],
            });
            mockOrderRefillService.processMany.mockResolvedValue(1);

            const result = await useCase.execute('0x123', 'user-uuid-1');

            expect(mockOrderRefillService.processMany).toHaveBeenCalledWith(
                [buyOrder1, buyOrder2],
                grid,
                '0x123',
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
            mockGrids.findActiveGridsByUserId.mockResolvedValue([grid]);
            mockGrids.findPlacedOrdersByGridIds.mockResolvedValue([order, order2]);

            mockOrderStatusSyncService.process.mockResolvedValue({
                filled: 2,
                filledOrders: [order, order2],
                stpCancelledOrders: [],
            });
            mockOrderRefillService.processMany.mockResolvedValue(1);

            const result = await useCase.execute('0x123', 'user-uuid-1');

            expect(result.fillsDetected).toBe(2);
            expect(result.refillsPlaced).toBe(1);
        });

        it('should reflect stpRecovered from stpRecoveryService.recoverMany', async () => {
            const grid = createTestGrid();
            const orderId = crypto.randomUUID();
            const order = createTestOrder(grid.id, { id: orderId });

            mockOrderClient.getOpenSpotOrders.mockResolvedValue([]);
            mockGrids.findActiveGridsByUserId.mockResolvedValue([grid]);
            mockGrids.findPlacedOrdersByGridIds.mockResolvedValue([order]);
            mockOrderStatusSyncService.process.mockResolvedValue({
                filled: 0,
                filledOrders: [],
                stpCancelledOrders: [order],
            });
            mockStpRecoveryService.recoverMany.mockResolvedValue(2);

            const result = await useCase.execute('0x123', 'user-uuid-1');

            expect(result.stpRecovered).toBe(2);
        });
    });

    describe('executeForGrids', () => {
        it('should return empty result when activeGrids is empty', async () => {
            const result = await useCase.executeForGrids('0x123', [], []);

            expect(result.gridsProcessed).toBe(0);
            expect(result.fillsDetected).toBe(0);
            expect(mockGrids.findPlacedOrdersByGridIds).not.toHaveBeenCalled();
        });

        it('should return empty result when no placed orders exist', async () => {
            const grid = createTestGrid();
            mockGrids.findPlacedOrdersByGridIds.mockResolvedValue([]);

            const result = await useCase.executeForGrids('0x123', [grid], []);

            expect(result.gridsProcessed).toBe(0);
            expect(mockOrderStatusSyncService.process).not.toHaveBeenCalled();
        });

        it('should process grids with pre-fetched exchange orders', async () => {
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
                filledAmount: Decimal.zero(),
                status: ExchangeOrderStatus.OPEN,
                reduceOnly: false,
                placedAt: Date.now(),
            };

            mockGrids.findPlacedOrdersByGridIds.mockResolvedValue([order]);
            mockOrderStatusSyncService.process.mockResolvedValue({
                filled: 1,
                filledOrders: [order],
                stpCancelledOrders: [],
            });
            mockOrderRefillService.processMany.mockResolvedValue(1);

            const result = await useCase.executeForGrids('0x123', [grid], [exchangeOrder]);

            expect(result.gridsProcessed).toBe(1);
            expect(result.fillsDetected).toBe(1);
            expect(result.refillsPlaced).toBe(1);
            // Should NOT call exchange.getOpenSpotOrders (already provided)
            expect(mockOrderClient.getOpenSpotOrders).not.toHaveBeenCalled();
            expect(mockGrids.findPlacedOrdersByGridIds).toHaveBeenCalledWith([grid.id]);
        });

        it('should handle errors per grid and continue processing', async () => {
            const grid1 = createTestGrid();
            const grid2 = createTestGrid();
            const order1 = createTestOrder(grid1.id);
            const order2 = createTestOrder(grid2.id);

            mockGrids.findPlacedOrdersByGridIds.mockResolvedValue([order1, order2]);
            mockOrderStatusSyncService.process
                .mockRejectedValueOnce(new Error('DB error'))
                .mockResolvedValueOnce({ filled: 0, filledOrders: [], stpCancelledOrders: [] });

            const result = await useCase.executeForGrids('0x123', [grid1, grid2], []);

            expect(result.errors.length).toBe(1);
            expect(result.errors[0]).toContain('DB error');
        });
    });
});
