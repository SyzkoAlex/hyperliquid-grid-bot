import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule, DRIZZLE_DB } from '@infra/database/database.module';
import { EventBusModule } from '@infra/events/event-bus.module';
import { HttpModule } from '@infra/http/http.module';
import { TradingModule } from '@components/trading/trading.module';
import { OrdersPollingController } from './orders-polling.controller';
import { HyperliquidOrderClientAdapter } from '@components/trading/infra/adapters/outbound/exchange/hyperliquid/hyperliquid-order-client.adapter';
import { OrderEventsListener } from '@components/trading/infra/adapters/outbound/exchange/hyperliquid/order-events.listener';
import { PostgresGridRepositoryAdapter } from '@components/trading/infra/adapters/outbound/persistence/grid/postgres-grid-repository.adapter';
import { PostgresOrderRepositoryAdapter } from '@components/trading/infra/adapters/outbound/persistence/order/postgres-order-repository.adapter';
import { GRID_REPOSITORY_PORT } from '@components/trading/domain/ports/outbound/grid-repository.port';
import { ORDER_REPOSITORY_PORT } from '@components/trading/domain/ports/outbound/order-repository.port';
import { EXCHANGE_CLIENT_PORT } from '@components/trading/domain/ports/outbound/exchange-client.port';
import { Grid } from '@domain/models/grid/grid';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Price } from '@domain/models/primitives/price';
import { Decimal } from '@domain/models/primitives/decimal';
import { GridMode } from '@domain/models/grid/grid-mode';
import { Order } from '@domain/models/order/order';
import { OrderType } from '@domain/models/order/order-type';
import { OrderSide } from '@domain/models/order/order-side';
import { OrderStatus } from '@domain/models/order/order-status';
import { OrderId } from '@domain/models/order/order-id';
import { ExchangeOrderStatus } from '@components/trading/domain/models/exchange-order/exchange-order-status';
import { ExchangeCloid } from '@domain/models/exchange-order/exchange-cloid';
import { DatabaseTestHelper } from '@infra/database/database-test-helper';
import { CacheTestHelper } from '@infra/cache/cache-test-helper';
import type { DrizzleDb } from '@infra/database/drizzle-db';
import { AppConfigModule } from '@infra/config/app-config.module';

/**
 * Integration Tests for OrdersPollingController
 *
 * Real integration test that:
 * - Uses NestJS Test.createTestingModule() to initialize TradingModule
 * - Uses DatabaseTestHelper for PostgreSQL (real testcontainer)
 * - Uses CacheTestHelper for Redis (real testcontainer)
 * - Mocks only Hyperliquid HTTP API calls
 * - Tests real end-to-end order synchronization flow
 *
 * Prerequisites:
 * - Docker must be running for testcontainers
 *
 * Run with: pnpm test:integration orders-monitor
 */
describe('OrdersPollingController (Integration)', () => {
    let module: TestingModule;
    let monitor: OrdersPollingController;
    let gridRepository: PostgresGridRepositoryAdapter;
    let orderRepository: PostgresOrderRepositoryAdapter;
    let hyperliquidOrderClient: HyperliquidOrderClientAdapter;
    let db: DrizzleDb;

    beforeAll(async () => {
        await initializeTestModule();
    });

    afterEach(async () => {
        // Clean up test data after each test
        await DatabaseTestHelper.cleanup();
        await CacheTestHelper.cleanup();
        vi.clearAllMocks();
    });

    afterAll(async () => {
        // Stop monitor
        if (monitor) {
            monitor.onModuleDestroy();
        }

        // Close module
        if (module) {
            await module.close();
        }

        // Close testcontainers
        await DatabaseTestHelper.close();
        await CacheTestHelper.close();
    });

    describe('Order Synchronization Flow', () => {
        it('should detect filled orders and refill them', async () => {
            // Create a test grid
            const grid = Grid.create({
                symbol: TradingSymbol.create('BTC'),
                mode: GridMode.Neutral,
                lowerPrice: Price.from(45000),
                upperPrice: Price.from(55000),
                levels: 10,
                investmentUSDC: Decimal.from(5000),
                investmentBase: Decimal.from(0.1),
                trailingEnabled: false,
                trailingTriggerPercent: 5,
                trailingStepPercent: 2,
                trailingPartialClosePercent: 50,
            });

            grid.start();
            await gridRepository.save(grid);

            // Create a placed order
            const order = Order.create({
                id: OrderId.create(),
                exchangeOrderId: '12345',
                symbol: TradingSymbol.create('BTC'),
                type: OrderType.Limit,
                side: OrderSide.Buy,
                price: Price.from(50000),
                amount: Decimal.from(0.01),
                status: OrderStatus.Placed,
                gridId: grid.id,
                levelIndex: 5,
            });

            await orderRepository.save(order);

            // Mock Hyperliquid responses
            // 1. getOpenSpotOrders - order is not in open orders (it was filled)
            vi.mocked(hyperliquidOrderClient.getOpenSpotOrders).mockResolvedValue([]);

            // 2. getOrderStatus - order was filled
            vi.mocked(hyperliquidOrderClient.getOrderStatus).mockResolvedValue({
                exchangeOrderId: '12345',
                status: ExchangeOrderStatus.FILLED,
                statusTimestamp: Date.now(),
            });

            // 3. placeSpotOrder - mock successful refill order placement
            vi.mocked(hyperliquidOrderClient.placeSpotOrder).mockResolvedValue({
                exchangeOrderId: '67890',
                status: OrderStatus.Placed,
            });

            // Execute order sync manually (instead of waiting for interval)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (monitor as any).checkOrders();

            // Verify order was marked as filled
            const updatedOrder = await orderRepository.findOneByExchangeOrderId('12345');
            expect(updatedOrder?.status).toBe(OrderStatus.Filled);
            expect(updatedOrder?.filledAt).toBeDefined();

            // Verify refill order was created
            const allOrders = await orderRepository.findManyActive(grid.id);
            const newOrders = allOrders.filter((o) => o.id.toString() !== order.id.toString());
            expect(newOrders.length).toBeGreaterThan(0);
        });

        it('should handle cancelled orders', async () => {
            // Create a test grid
            const grid = Grid.create({
                symbol: TradingSymbol.create('ETH'),
                mode: GridMode.Neutral,
                lowerPrice: Price.from(2500),
                upperPrice: Price.from(3500),
                levels: 10,
                investmentUSDC: Decimal.from(3000),
                investmentBase: Decimal.from(1),
                trailingEnabled: false,
                trailingTriggerPercent: 5,
                trailingStepPercent: 2,
                trailingPartialClosePercent: 50,
            });

            grid.start();
            await gridRepository.save(grid);

            // Create a placed order
            const order = Order.create({
                id: OrderId.create(),
                exchangeOrderId: '99999',
                symbol: TradingSymbol.create('ETH'),
                type: OrderType.Limit,
                side: OrderSide.Sell,
                price: Price.from(3000),
                amount: Decimal.from(0.1),
                status: OrderStatus.Placed,
                gridId: grid.id,
                levelIndex: 5,
            });

            await orderRepository.save(order);

            // Mock Hyperliquid responses
            vi.mocked(hyperliquidOrderClient.getOpenSpotOrders).mockResolvedValue([]);

            vi.mocked(hyperliquidOrderClient.getOrderStatus).mockResolvedValue({
                exchangeOrderId: '99999',
                status: ExchangeOrderStatus.CANCELED,
                statusTimestamp: Date.now(),
            });

            // Execute order sync
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (monitor as any).checkOrders();

            // Verify order was marked as cancelled
            const updatedOrder = await orderRepository.findOneByExchangeOrderId('99999');
            expect(updatedOrder?.status).toBe(OrderStatus.Cancelled);
        });

        it('should handle orders still open on exchange', async () => {
            // Create a test grid
            const grid = Grid.create({
                symbol: TradingSymbol.create('SOL'),
                mode: GridMode.Neutral,
                lowerPrice: Price.from(100),
                upperPrice: Price.from(150),
                levels: 5,
                investmentUSDC: Decimal.from(1000),
                investmentBase: Decimal.from(10),
                trailingEnabled: false,
                trailingTriggerPercent: 5,
                trailingStepPercent: 2,
                trailingPartialClosePercent: 50,
            });

            grid.start();
            await gridRepository.save(grid);

            // Create a placed order
            const orderId = OrderId.create();
            const order = Order.create({
                id: orderId,
                exchangeOrderId: '11111',
                symbol: TradingSymbol.create('SOL'),
                type: OrderType.Limit,
                side: OrderSide.Buy,
                price: Price.from(120),
                amount: Decimal.from(1),
                status: OrderStatus.Placed,
                gridId: grid.id,
                levelIndex: 2,
            });

            await orderRepository.save(order);

            // Mock order still exists on exchange
            vi.mocked(hyperliquidOrderClient.getOpenSpotOrders).mockResolvedValue([
                {
                    id: '11111',
                    cloid: ExchangeCloid.create(orderId),
                    symbol: TradingSymbol.create('SOL'),
                    type: OrderType.Limit,
                    side: OrderSide.Buy,
                    price: Price.from(120),
                    amount: Decimal.from(1),
                    filledAmount: Decimal.zero(),
                    status: ExchangeOrderStatus.OPEN,
                    reduceOnly: false,
                    placedAt: Date.now(),
                },
            ]);

            // Execute order sync
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (monitor as any).checkOrders();

            // Verify order status unchanged
            const updatedOrder = await orderRepository.findOneByExchangeOrderId('11111');
            expect(updatedOrder?.status).toBe(OrderStatus.Placed);
        });
    });

    describe('Error Handling', () => {
        it('should handle Hyperliquid API errors gracefully', async () => {
            // Create a test grid
            const grid = Grid.create({
                symbol: TradingSymbol.create('AVAX'),
                mode: GridMode.Neutral,
                lowerPrice: Price.from(30),
                upperPrice: Price.from(40),
                levels: 5,
                investmentUSDC: Decimal.from(500),
                investmentBase: Decimal.from(10),
                trailingEnabled: false,
                trailingTriggerPercent: 5,
                trailingStepPercent: 2,
                trailingPartialClosePercent: 50,
            });

            grid.start();
            await gridRepository.save(grid);

            // Mock API failure
            vi.mocked(hyperliquidOrderClient.getOpenSpotOrders).mockRejectedValue(
                new Error('Network timeout'),
            );

            // Should not throw
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await expect((monitor as any).checkOrders()).resolves.toBeUndefined();
        });
    });

    describe('Concurrent Execution Prevention', () => {
        it('should prevent concurrent sync execution', async () => {
            // Set processing flag
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (monitor as any).isProcessing = true;

            const spy = vi.spyOn(hyperliquidOrderClient, 'getOpenSpotOrders');

            // Try to execute sync - should be skipped
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (monitor as any).checkOrders();

            // Verify no API calls were made
            expect(spy).not.toHaveBeenCalled();

            // Reset flag
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (monitor as any).isProcessing = false;
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
        const mockOrderEventsListener = {
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
        moduleBuilder.overrideProvider(EXCHANGE_CLIENT_PORT).useValue(mockHyperliquidOrderClient);
        moduleBuilder.overrideProvider(OrderEventsListener).useValue(mockOrderEventsListener);

        // Compile module
        module = await moduleBuilder.compile();

        // Get instances from module
        monitor = module.get<OrdersPollingController>(OrdersPollingController);
        gridRepository = module.get<PostgresGridRepositoryAdapter>(GRID_REPOSITORY_PORT);
        orderRepository = module.get<PostgresOrderRepositoryAdapter>(ORDER_REPOSITORY_PORT);
        hyperliquidOrderClient = module.get<HyperliquidOrderClientAdapter>(EXCHANGE_CLIENT_PORT);
    }
});
