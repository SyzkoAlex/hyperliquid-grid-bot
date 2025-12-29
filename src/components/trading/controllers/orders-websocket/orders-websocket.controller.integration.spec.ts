import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule, DRIZZLE_DB } from '@infra/database/database.module';
import { EventBusModule } from '@infra/events/event-bus.module';
import { HttpModule } from '@infra/http/http.module';
import { AppConfigModule } from '@infra/config/app-config.module';
import { TradingModule } from '../../trading.module';
import { OrdersWebsocketController } from './orders-websocket.controller';
import { HyperliquidOrderClient } from '../../secondary/client/hyperliquid/hyperliquid-order.client';
import { HyperliquidUserEventsClient } from '../../secondary/client/hyperliquid/hyperliquid-user-events.client';
import { PostgresGridRepository } from '../../secondary/repository/grid/postgres-grid.repository';
import { PostgresOrderRepository } from '../../secondary/repository/order/postgres-order.repository';
import { Grid } from '../../core/domain/grid/grid';
import { Symbol as TradingSymbol } from '../../core/domain/common/symbol';
import { Price } from '../../core/domain/common/price';
import { Decimal } from '@domain/primitives/decimal';
import { GridMode } from '../../core/domain/grid/grid-mode';
import { Order } from '../../core/domain/order/order';
import { OrderType } from '../../core/domain/order/order-type';
import { OrderSide } from '../../core/domain/order/order-side';
import { OrderStatus } from '../../core/domain/order/order-status';
import { OrderId } from '../../core/domain/order/order-id';
import { DatabaseTestHelper } from '@infra/database/database-test-helper';
import { CacheTestHelper } from '@infra/cache/cache-test-helper';
import type { DrizzleDb } from '@infra/database/drizzle-db';
import type { HyperliquidWsOrderStatus } from '../../secondary/client/hyperliquid/types/hyperliquid-ws-user-event';

/**
 * Integration Tests for OrdersWebsocketController
 *
 * Real integration test that:
 * - Uses NestJS Test.createTestingModule() to initialize TradingModule
 * - Uses DatabaseTestHelper for PostgreSQL (real testcontainer)
 * - Uses CacheTestHelper for Redis (real testcontainer)
 * - Simulates WebSocket events by directly calling event handlers
 * - Tests real end-to-end WebSocket event processing flow
 *
 * Prerequisites:
 * - Docker must be running for testcontainers
 *
 * Run with: pnpm test:integration orders-websocket
 */
describe('OrdersWebsocketController (Integration)', () => {
    let module: TestingModule;
    let controller: OrdersWebsocketController;
    let gridRepository: PostgresGridRepository;
    let orderRepository: PostgresOrderRepository;
    let hyperliquidOrderClient: HyperliquidOrderClient;
    let db: DrizzleDb;

    let statusCallback: (status: HyperliquidWsOrderStatus) => void;

    beforeAll(async () => {
        await initializeTestModule();
    });

    afterEach(async () => {
        await DatabaseTestHelper.cleanup();
        await CacheTestHelper.cleanup();
        vi.clearAllMocks();
    });

    afterAll(async () => {
        if (controller) {
            controller.onModuleDestroy();
        }

        if (module) {
            await module.close();
        }

        await DatabaseTestHelper.close();
        await CacheTestHelper.close();
    });

    describe('Order Status Event Processing', () => {
        it('should process filled status event and trigger refill', async () => {
            const grid = Grid.create({
                symbol: TradingSymbol.create('ETH'),
                mode: GridMode.Long,
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

            const order = Order.create({
                id: OrderId.create(),
                exchangeOrderId: '77777',
                symbol: TradingSymbol.create('ETH'),
                type: OrderType.Limit,
                side: OrderSide.Sell,
                price: Price.from(3000),
                amount: Decimal.from(0.1),
                status: OrderStatus.Placed,
                gridId: grid.id.toString(),
                levelIndex: 6,
            });

            await orderRepository.save(order);

            vi.mocked(hyperliquidOrderClient.placeSpotOrder).mockResolvedValue({
                exchangeOrderId: '88888',
                status: OrderStatus.Placed,
            });

            const statusEvent: HyperliquidWsOrderStatus = {
                order: {
                    coin: 'ETH',
                    oid: 77777,
                    side: 'A',
                    limitPx: '3000',
                    sz: '0.1',
                    timestamp: Date.now() - 10000,
                },
                status: 'filled',
                statusTimestamp: Date.now(),
            };

            await statusCallback(statusEvent);

            const updatedOrder = await orderRepository.findOneByExchangeOrderId('77777');
            expect(updatedOrder?.status).toBe(OrderStatus.Filled);

            const allOrders = await orderRepository.findManyActive(grid.id);
            const newOrders = allOrders.filter((o) => o.id.toString() !== order.id.toString());
            expect(newOrders.length).toBeGreaterThan(0);
        });

        it('should process canceled status event', async () => {
            const grid = Grid.create({
                symbol: TradingSymbol.create('SOL'),
                mode: GridMode.Neutral,
                lowerPrice: Price.from(100),
                upperPrice: Price.from(150),
                levels: 10,
                investmentUSDC: Decimal.from(2000),
                investmentBase: Decimal.from(20),
                trailingEnabled: false,
                trailingTriggerPercent: 5,
                trailingStepPercent: 2,
                trailingPartialClosePercent: 50,
            });

            grid.start();
            await gridRepository.save(grid);

            const order = Order.create({
                id: OrderId.create(),
                exchangeOrderId: '33333',
                symbol: TradingSymbol.create('SOL'),
                type: OrderType.Limit,
                side: OrderSide.Buy,
                price: Price.from(120),
                amount: Decimal.from(1),
                status: OrderStatus.Placed,
                gridId: grid.id.toString(),
                levelIndex: 4,
            });

            await orderRepository.save(order);

            const statusEvent: HyperliquidWsOrderStatus = {
                order: {
                    coin: 'SOL',
                    oid: 33333,
                    side: 'B',
                    limitPx: '120',
                    sz: '1',
                    timestamp: Date.now() - 10000,
                },
                status: 'canceled',
                statusTimestamp: Date.now(),
            };

            await statusCallback(statusEvent);

            const updatedOrder = await orderRepository.findOneByExchangeOrderId('33333');
            expect(updatedOrder?.status).toBe(OrderStatus.Cancelled);
        });

        it('should ignore status events for non-grid orders', async () => {
            const statusEvent: HyperliquidWsOrderStatus = {
                order: {
                    coin: 'BTC',
                    oid: 99999,
                    side: 'B',
                    limitPx: '50000',
                    sz: '0.01',
                    timestamp: Date.now() - 10000,
                },
                status: 'filled',
                statusTimestamp: Date.now(),
            };

            await statusCallback(statusEvent);
        });
    });

    describe('Controller Lifecycle', () => {
        it('should subscribe to events on module init', () => {
            expect(statusCallback).toBeDefined();
        });
    });

    async function initializeTestModule() {
        db = await DatabaseTestHelper.initialize();
        await CacheTestHelper.initialize();

        const mockHyperliquidOrderClient = {
            getOpenSpotOrders: vi.fn(),
            getOrderStatus: vi.fn(),
            getUserState: vi.fn(),
            placeSpotOrder: vi.fn(),
            cancelSpotOrder: vi.fn(),
        };

        const mockHyperliquidUserEventsClient = {
            onModuleInit: vi.fn(),
            onModuleDestroy: vi.fn(),
            connect: vi.fn(),
            disconnect: vi.fn(),
            onOrderStatus: vi.fn((callback) => {
                statusCallback = callback;
                return () => {
                    // unsubscribe
                };
            }),
        };

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

        moduleBuilder.overrideProvider(DRIZZLE_DB).useValue(db);
        moduleBuilder.overrideProvider(HyperliquidOrderClient).useValue(mockHyperliquidOrderClient);
        moduleBuilder
            .overrideProvider(HyperliquidUserEventsClient)
            .useValue(mockHyperliquidUserEventsClient);

        module = await moduleBuilder.compile();

        controller = module.get<OrdersWebsocketController>(OrdersWebsocketController);
        gridRepository = module.get<PostgresGridRepository>(PostgresGridRepository);
        orderRepository = module.get<PostgresOrderRepository>(PostgresOrderRepository);
        hyperliquidOrderClient = module.get<HyperliquidOrderClient>(HyperliquidOrderClient);

        controller.onModuleInit();
    }
});
