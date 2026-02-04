import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule, DRIZZLE_DB } from '@infra/database/database.module';
import { EventBusModule } from '@infra/events/event-bus.module';
import { HttpModule } from '@infra/http/http.module';
import { TradingModule } from '../../trading.module';
import { OrdersRestoreController } from './orders-restore.controller';
import { HyperliquidOrderClient } from '../../secondary/client/hyperliquid/hyperliquid-order.client';
import { HyperliquidUserEventsClient } from '../../secondary/client/hyperliquid/hyperliquid-user-events.client';
import { PostgresOrderRepository } from '../../secondary/repository/order/postgres-order.repository';
import { Order } from '../../core/domain/order/order';
import { OrderType } from '../../core/domain/order/order-type';
import { OrderSide } from '../../core/domain/order/order-side';
import { OrderStatus } from '../../core/domain/order/order-status';
import { OrderId } from '../../core/domain/order/order-id';
import { Symbol as TradingSymbol } from '../../core/domain/common/symbol';
import { Price } from '../../core/domain/common/price';
import { Decimal } from '@domain/primitives/decimal';
import { Grid } from '../../core/domain/grid/grid';
import { GridMode } from '../../core/domain/grid/grid-mode';
import { ExchangeOrderStatus } from '../../core/domain/exchange-order/exchange-order-status';
import { ExchangeCloid } from '../../core/domain/exchange-order/exchange-cloid';
import { PostgresGridRepository } from '../../secondary/repository/grid/postgres-grid.repository';
import { DatabaseTestHelper } from '@infra/database/database-test-helper';
import { CacheTestHelper } from '@infra/cache/cache-test-helper';
import type { DrizzleDb } from '@infra/database/drizzle-db';
import { AppConfigModule } from '@infra/config/app-config.module';
import { Timestamp } from '@domain/primitives/timestamp';

/**
 * Integration Tests for OrdersRestoreController
 *
 * Real integration test that:
 * - Uses NestJS Test.createTestingModule() to initialize TradingModule
 * - Uses DatabaseTestHelper for PostgreSQL (real testcontainer)
 * - Uses CacheTestHelper for Redis (real testcontainer)
 * - Mocks only Hyperliquid HTTP API calls
 * - Tests real end-to-end order restoration flow
 *
 * Prerequisites:
 * - Docker must be running for testcontainers
 *
 * Run with: pnpm test:integration orders-restore
 */
describe('OrdersRestoreController (Integration)', () => {
    let module: TestingModule;
    let controller: OrdersRestoreController;
    let orderRepository: PostgresOrderRepository;
    let gridRepository: PostgresGridRepository;
    let hyperliquidOrderClient: HyperliquidOrderClient;
    let db: DrizzleDb;
    let testGrid1: Grid;
    let testGrid2: Grid;

    beforeAll(async () => {
        await initializeTestModule();
    });

    beforeEach(async () => {
        // Create test grids that will be used for orders in each test
        testGrid1 = Grid.create({
            symbol: TradingSymbol.create('BTC'),
            mode: GridMode.Neutral,
            lowerPrice: Price.from(45000),
            upperPrice: Price.from(55000),
            levels: 11,
            investmentUSDC: Decimal.from(5000),
            investmentBase: Decimal.from(0.1),
            trailingEnabled: false,
            trailingTriggerPercent: 5,
            trailingStepPercent: 10,
            trailingPartialClosePercent: 50,
        });
        testGrid1.start();
        await gridRepository.save(testGrid1);

        testGrid2 = Grid.create({
            symbol: TradingSymbol.create('ETH'),
            mode: GridMode.Neutral,
            lowerPrice: Price.from(2500),
            upperPrice: Price.from(3500),
            levels: 11,
            investmentUSDC: Decimal.from(3000),
            investmentBase: Decimal.from(1),
            trailingEnabled: false,
            trailingTriggerPercent: 5,
            trailingStepPercent: 10,
            trailingPartialClosePercent: 50,
        });
        testGrid2.start();
        await gridRepository.save(testGrid2);
    });

    afterEach(async () => {
        // Clean up test data after each test
        await DatabaseTestHelper.cleanup();
        await CacheTestHelper.cleanup();
        vi.clearAllMocks();
    });

    afterAll(async () => {
        // Stop controller
        if (controller) {
            controller.onModuleDestroy();
        }

        // Close module
        if (module) {
            await module.close();
        }

        // Close testcontainers
        await DatabaseTestHelper.close();
        await CacheTestHelper.close();
    });

    describe('Order Restoration Flow', () => {
        it('should restore pending order by matching cloid', async () => {
            const orderId = OrderId.create();
            const gridId = testGrid1.id;
            const cloid = ExchangeCloid.create(orderId);

            // Create pending order with cloid
            const pendingOrder = Order.create({
                id: orderId,
                exchangeOrderId: undefined,
                symbol: TradingSymbol.create('BTC'),
                type: OrderType.Limit,
                side: OrderSide.Buy,
                price: Price.from(50000),
                amount: Decimal.from(0.01),
                status: OrderStatus.Pending,
                gridId: gridId,
                levelIndex: 5,
            });

            await orderRepository.save(pendingOrder);

            // Mock exchange response with matching cloid
            vi.mocked(hyperliquidOrderClient.getOpenSpotOrders).mockResolvedValue([
                {
                    id: 'exchange-order-123',
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
                },
            ]);

            // Execute restore manually
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (controller as any).runRestore();

            // Verify order was restored
            const restoredOrder =
                await orderRepository.findOneByExchangeOrderId('exchange-order-123');
            expect(restoredOrder).toBeDefined();
            expect(restoredOrder).not.toBeNull();
            if (!restoredOrder) throw new Error('restoredOrder is null');

            expect(restoredOrder.id.toString()).toBe(pendingOrder.id.toString());
            expect(restoredOrder.exchangeOrderId).toBe('exchange-order-123');
            expect(restoredOrder.status).toBe(OrderStatus.Placed);
            // Note: cloid is not persisted in DB, it's only derivable for pending orders
            // After restoration, order status changes to Placed so cloid getter returns null
        });

        it('should restore multiple pending orders with different cloids', async () => {
            const orderId1 = OrderId.create();
            const orderId2 = OrderId.create();
            const gridId1 = testGrid1.id;
            const gridId2 = testGrid2.id;
            const cloid1 = ExchangeCloid.create(orderId1);
            const cloid2 = ExchangeCloid.create(orderId2);

            // Create two pending orders
            const pendingOrder1 = Order.create({
                id: orderId1,
                exchangeOrderId: undefined,
                symbol: TradingSymbol.create('BTC'),
                type: OrderType.Limit,
                side: OrderSide.Buy,
                price: Price.from(49000),
                amount: Decimal.from(0.01),
                status: OrderStatus.Pending,
                gridId: gridId1,
                levelIndex: 4,
            });

            const pendingOrder2 = Order.create({
                id: orderId2,
                exchangeOrderId: undefined,
                symbol: TradingSymbol.create('ETH'),
                type: OrderType.Limit,
                side: OrderSide.Sell,
                price: Price.from(3000),
                amount: Decimal.from(0.1),
                status: OrderStatus.Pending,
                gridId: gridId2,
                levelIndex: 6,
            });

            await orderRepository.save(pendingOrder1);
            await orderRepository.save(pendingOrder2);

            // Mock exchange response with both orders
            vi.mocked(hyperliquidOrderClient.getOpenSpotOrders).mockResolvedValue([
                {
                    id: 'exchange-order-1',
                    cloid: cloid1,
                    symbol: TradingSymbol.create('BTC'),
                    type: OrderType.Limit,
                    side: OrderSide.Buy,
                    price: Price.from(49000),
                    amount: Decimal.from(0.01),
                    filledAmount: Decimal.zero(),
                    status: ExchangeOrderStatus.OPEN,
                    reduceOnly: false,
                    placedAt: Date.now(),
                },
                {
                    id: 'exchange-order-2',
                    cloid: cloid2,
                    symbol: TradingSymbol.create('ETH'),
                    type: OrderType.Limit,
                    side: OrderSide.Sell,
                    price: Price.from(3000),
                    amount: Decimal.from(0.1),
                    filledAmount: Decimal.zero(),
                    status: ExchangeOrderStatus.OPEN,
                    reduceOnly: false,
                    placedAt: Date.now(),
                },
            ]);

            // Execute restore
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (controller as any).runRestore();

            // Verify both orders were restored
            const restored1 = await orderRepository.findOneByExchangeOrderId('exchange-order-1');
            const restored2 = await orderRepository.findOneByExchangeOrderId('exchange-order-2');

            expect(restored1).not.toBeNull();
            expect(restored2).not.toBeNull();
            if (!restored1 || !restored2) throw new Error('Orders not restored');

            expect(restored1.status).toBe(OrderStatus.Placed);
            expect(restored2.status).toBe(OrderStatus.Placed);
        });

        it('should mark stale pending orders as missing', async () => {
            const orderId = OrderId.create();
            const gridId = testGrid1.id;

            // Create stale pending order (older than threshold of 5 minutes)
            const staleTimestamp = Timestamp.from(new Date(Date.now() - 400000)); // 6.67 minutes ago
            const stalePendingOrder = Order.create({
                id: orderId,
                exchangeOrderId: undefined,
                symbol: TradingSymbol.create('SOL'),
                type: OrderType.Limit,
                side: OrderSide.Buy,
                price: Price.from(120),
                amount: Decimal.from(1),
                status: OrderStatus.Pending,
                gridId: gridId,
                levelIndex: 3,
                placedAt: staleTimestamp,
            });

            await orderRepository.save(stalePendingOrder);

            // Mock exchange has no matching order
            vi.mocked(hyperliquidOrderClient.getOpenSpotOrders).mockResolvedValue([]);

            // Execute restore
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (controller as any).runRestore();

            // Verify order was marked as missing
            const pendingOrders = await orderRepository.findManyByStatus(OrderStatus.Pending);
            expect(
                pendingOrders.some((o) => o.id.toString() === stalePendingOrder.id.toString()),
            ).toBe(false);

            const missingOrders = await orderRepository.findManyByStatus(OrderStatus.Missing);
            expect(
                missingOrders.some((o) => o.id.toString() === stalePendingOrder.id.toString()),
            ).toBe(true);
        });

        it('should not mark fresh pending order as missing', async () => {
            const orderId = OrderId.create();
            const gridId = testGrid1.id;

            // Create fresh pending order
            const freshTimestamp = Timestamp.from(new Date(Date.now() - 5000)); // 5 seconds ago
            const freshPendingOrder = Order.create({
                id: orderId,
                exchangeOrderId: undefined,
                symbol: TradingSymbol.create('AVAX'),
                type: OrderType.Limit,
                side: OrderSide.Buy,
                price: Price.from(35),
                amount: Decimal.from(1),
                status: OrderStatus.Pending,
                gridId: gridId,
                levelIndex: 2,
                placedAt: freshTimestamp,
            });

            await orderRepository.save(freshPendingOrder);

            // Mock exchange has no matching order
            vi.mocked(hyperliquidOrderClient.getOpenSpotOrders).mockResolvedValue([]);

            // Execute restore
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (controller as any).runRestore();

            // Verify order is still pending
            const pendingOrders = await orderRepository.findManyByStatus(OrderStatus.Pending);
            expect(
                pendingOrders.some((o) => o.id.toString() === freshPendingOrder.id.toString()),
            ).toBe(true);

            const missingOrders = await orderRepository.findManyByStatus(OrderStatus.Missing);
            expect(
                missingOrders.some((o) => o.id.toString() === freshPendingOrder.id.toString()),
            ).toBe(false);
        });

        it('should handle restore when no pending orders exist', async () => {
            // Mock empty exchange response
            vi.mocked(hyperliquidOrderClient.getOpenSpotOrders).mockResolvedValue([]);

            // Should not throw
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await expect((controller as any).runRestore()).resolves.toBeUndefined();
        });
    });

    describe('Error Handling', () => {
        it('should handle Hyperliquid API errors gracefully', async () => {
            const orderId = OrderId.create();
            const gridId = testGrid1.id;

            const pendingOrder = Order.create({
                id: orderId,
                exchangeOrderId: undefined,
                symbol: TradingSymbol.create('BTC'),
                type: OrderType.Limit,
                side: OrderSide.Buy,
                price: Price.from(50000),
                amount: Decimal.from(0.01),
                status: OrderStatus.Pending,
                gridId: gridId,
                levelIndex: 5,
            });

            await orderRepository.save(pendingOrder);

            // Mock API failure
            vi.mocked(hyperliquidOrderClient.getOpenSpotOrders).mockRejectedValue(
                new Error('Network timeout'),
            );

            // Should not throw and should log error
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await expect((controller as any).runRestore()).resolves.toBeUndefined();
        });
    });

    describe('Concurrent Execution Prevention', () => {
        it('should prevent concurrent restore execution', async () => {
            // Set running flag
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (controller as any).isRunning = true;

            const spy = vi.spyOn(hyperliquidOrderClient, 'getOpenSpotOrders');

            // Try to execute restore - should be skipped
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (controller as any).runRestore();

            // Verify no API calls were made
            expect(spy).not.toHaveBeenCalled();

            // Reset flag
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (controller as any).isRunning = false;
        });
    });

    async function initializeTestModule() {
        // Initialize testcontainers
        db = await DatabaseTestHelper.initialize();
        await CacheTestHelper.initialize();

        // Create mocked Hyperliquid client
        const mockHyperliquidOrderClient = {
            getOpenSpotOrders: vi.fn(),
            getOrderStatus: vi.fn(),
            getUserState: vi.fn(),
            placeSpotOrder: vi.fn(),
            cancelSpotOrder: vi.fn(),
        };

        // Mock websocket client (not needed for this test)
        const mockHyperliquidUserEventsClient = {
            onModuleInit: vi.fn(),
            onModuleDestroy: vi.fn(),
            connect: vi.fn(),
            disconnect: vi.fn(),
        };

        // Create NestJS testing module with TradingModule
        const moduleBuilder = Test.createTestingModule({
            imports: [
                ScheduleModule.forRoot(),
                AppConfigModule.forRoot(),
                DatabaseModule,
                HttpModule,
                EventBusModule,
                TradingModule,
            ],
        });

        // Override providers
        moduleBuilder.overrideProvider(DRIZZLE_DB).useValue(db);
        moduleBuilder.overrideProvider(HyperliquidOrderClient).useValue(mockHyperliquidOrderClient);
        moduleBuilder
            .overrideProvider(HyperliquidUserEventsClient)
            .useValue(mockHyperliquidUserEventsClient);

        // Compile module
        module = await moduleBuilder.compile();

        // Get instances from module
        controller = module.get<OrdersRestoreController>(OrdersRestoreController);
        orderRepository = module.get<PostgresOrderRepository>(PostgresOrderRepository);
        gridRepository = module.get<PostgresGridRepository>(PostgresGridRepository);
        hyperliquidOrderClient = module.get<HyperliquidOrderClient>(HyperliquidOrderClient);
    }
});
