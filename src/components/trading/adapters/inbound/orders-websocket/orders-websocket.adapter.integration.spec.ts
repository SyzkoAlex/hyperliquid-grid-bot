import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule, DRIZZLE_DB } from '@/infra/database/database.module';
import { HttpModule } from '@/infra/http/http.module';
import { AppConfigModule } from '@/config/app-config.module';
import { TradingModule } from '@components/trading/trading.module';
import { OrdersWebsocketAdapter } from './orders-websocket.adapter';
import { ProcessOrderStatusUseCase } from '@components/trading/core/application/use-cases/process-order-status/process-order-status.use-case';
import { GRIDS_API_PORT, GridsApiPort } from '@components/grids/api/grids-api.port';
import {
    EXCHANGE_PORT,
    ExchangePort,
} from '@components/trading/core/application/ports/exchange.port';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { OrderDto } from '@components/grids/api/dto/order.dto';
import { GridMode } from '@domain/models/grid/grid-mode';
import { GridStatus } from '@domain/models/grid/grid-status';
import { OrderType } from '@domain/models/order/order-type';
import { OrderSide } from '@domain/models/order/order-side';
import { OrderStatus } from '@domain/models/order/order-status';
import { DatabaseTestHelper } from '@/infra/tests/database-test-helper';
import { CacheTestHelper } from '@/infra/tests/cache-test-helper';
import type { DrizzleDb } from '@/infra/database/drizzle-db';
import type { OrderStatusUpdate } from '@components/trading/core/application/use-cases/process-order-status/order-status-update';

describe('OrdersWebsocketAdapter (Integration)', () => {
    let module: TestingModule;
    let processOrderStatus: ProcessOrderStatusUseCase;
    let gridsApi: GridsApiPort;
    let exchange: ExchangePort;
    let db: DrizzleDb;

    beforeAll(async () => {
        await initializeTestModule();
    });

    afterEach(async () => {
        await DatabaseTestHelper.cleanup();
        await CacheTestHelper.cleanup();
        vi.clearAllMocks();
    });

    afterAll(async () => {
        if (module) {
            await module.close();
        }

        await DatabaseTestHelper.close();
        await CacheTestHelper.close();
    });

    async function createGrid(
        symbol: string,
        overrides: Partial<Parameters<GridsApiPort['createGrid']>[0]> = {},
    ): Promise<GridDto> {
        const grid = await gridsApi.createGrid({
            id: crypto.randomUUID(),
            symbol,
            mode: GridMode.Neutral,
            lowerPrice: 2500,
            upperPrice: 3500,
            levels: 10,
            investmentUSDC: 3000,
            investmentBase: 1,
            trailingEnabled: false,
            trailingTriggerPercent: 5,
            trailingStepPercent: 2,
            trailingPartialClosePercent: 50,
            ...overrides,
        });
        await gridsApi.updateGridStatus(grid.id, GridStatus.Running);
        return { ...grid, status: GridStatus.Running };
    }

    async function createOrder(
        grid: GridDto,
        overrides: Partial<{
            side: OrderSide;
            price: number;
            exchangeOrderId: string;
            levelIndex: number;
            amount: number;
        }> = {},
    ): Promise<OrderDto> {
        const order = await gridsApi.createOrder({
            id: crypto.randomUUID(),
            gridId: grid.id,
            symbol: grid.symbol,
            side: overrides.side ?? OrderSide.Buy,
            type: OrderType.Limit,
            levelIndex: overrides.levelIndex ?? 5,
            price: overrides.price ?? 3000,
            amount: overrides.amount ?? 0.1,
        });

        if (overrides.exchangeOrderId) {
            await gridsApi.updateOrderExchangeId(
                order.id,
                overrides.exchangeOrderId,
                OrderStatus.Placed,
                new Date(),
            );
            return {
                ...order,
                exchangeOrderId: overrides.exchangeOrderId,
                status: OrderStatus.Placed,
            };
        }

        return order;
    }

    describe('Order Status Event Processing', () => {
        it('should handle filled status event and trigger refill', async () => {
            const grid = await createGrid('ETH', { mode: GridMode.Long });

            const order = await createOrder(grid, {
                side: OrderSide.Sell,
                price: 3000,
                exchangeOrderId: '77777',
                levelIndex: 6,
            });

            vi.mocked(exchange.placeSpotOrder).mockResolvedValue({
                exchangeOrderId: '88888',
                status: OrderStatus.Placed,
            });

            const statusEvent: OrderStatusUpdate = {
                exchangeOrderId: 77777,
                coin: 'ETH',
                status: 'filled',
                statusTimestamp: Date.now(),
            };

            await processOrderStatus.execute({ orderStatus: statusEvent });

            const updatedOrder = await gridsApi.findOrderByExchangeId('77777');
            expect(updatedOrder?.status).toBe(OrderStatus.Filled);

            const allOrders = await gridsApi.findActiveOrdersByGridId(grid.id);
            const newOrders = allOrders.filter((o) => o.id !== order.id);
            expect(newOrders.length).toBeGreaterThan(0);
        });

        it('should handle canceled status event', async () => {
            const grid = await createGrid('SOL', {
                lowerPrice: 100,
                upperPrice: 150,
                investmentUSDC: 2000,
                investmentBase: 20,
            });

            await createOrder(grid, {
                price: 120,
                exchangeOrderId: '33333',
                levelIndex: 4,
                amount: 1,
            });

            const statusEvent: OrderStatusUpdate = {
                exchangeOrderId: 33333,
                coin: 'SOL',
                status: 'canceled',
                statusTimestamp: Date.now(),
            };

            await processOrderStatus.execute({ orderStatus: statusEvent });

            const updatedOrder = await gridsApi.findOrderByExchangeId('33333');
            expect(updatedOrder?.status).toBe(OrderStatus.Cancelled);
        });

        it('should ignore status events for non-grid orders', async () => {
            const statusEvent: OrderStatusUpdate = {
                exchangeOrderId: 99999,
                coin: 'BTC',
                status: 'filled',
                statusTimestamp: Date.now(),
            };

            const result = await processOrderStatus.execute({ orderStatus: statusEvent });
            expect(result.isGridOrder).toBe(false);
        });
    });

    async function initializeTestModule() {
        db = await DatabaseTestHelper.initialize();
        await CacheTestHelper.initialize();

        const mockExchange = {
            getOpenSpotOrders: vi.fn(),
            getOrderStatus: vi.fn(),
            placeSpotOrder: vi.fn(),
            cancelSpotOrder: vi.fn(),
            getCurrentPrice: vi.fn(),
            getUserSpotState: vi.fn(),
            pairExists: vi.fn(),
        };

        const mockWsAdapter = {
            onModuleInit: vi.fn(),
            onModuleDestroy: vi.fn(),
            isConnected: vi.fn().mockReturnValue(false),
        };

        const moduleBuilder = Test.createTestingModule({
            imports: [
                ScheduleModule.forRoot(),
                AppConfigModule.forRoot(),
                DatabaseModule,
                HttpModule,
                TradingModule,
            ],
        });

        moduleBuilder.overrideProvider(DRIZZLE_DB).useValue(db);
        moduleBuilder.overrideProvider(EXCHANGE_PORT).useValue(mockExchange);
        moduleBuilder.overrideProvider(OrdersWebsocketAdapter).useValue(mockWsAdapter);

        module = await moduleBuilder.compile();

        processOrderStatus = module.get<ProcessOrderStatusUseCase>(ProcessOrderStatusUseCase);
        gridsApi = module.get<GridsApiPort>(GRIDS_API_PORT);
        exchange = module.get<ExchangePort>(EXCHANGE_PORT);
    }
});
