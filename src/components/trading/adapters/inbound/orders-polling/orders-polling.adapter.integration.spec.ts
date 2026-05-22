import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule, DRIZZLE_DB } from '@/infra/database/database.module';
import { HttpModule } from '@/infra/http/http.module';
import { TradingModule } from '@components/trading/trading.module';
import { OrdersPollingAdapter } from './orders-polling.adapter';
import { MockDistributedLockModule } from '@/infra/tests/mock-distributed-lock.module';
import { GRIDS_API_PORT, GridsApiPort } from '@components/grids/api/grids-api.port';
import {
    EXCHANGE_PORT,
    ExchangePort,
} from '@components/trading/core/application/ports/exchange.port';
import { USERS_API_PORT } from '@components/users/api/users-api.port';
import { UserStatus } from '@domain/models/user/user-status';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { OrderDto } from '@components/grids/api/dto/order.dto';
import { GridStatus } from '@domain/models/grid/grid-status';
import { OrderType } from '@domain/models/order/order-type';
import { OrderSide } from '@domain/models/order/order-side';
import { OrderStatus } from '@domain/models/order/order-status';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Price } from '@domain/models/primitives/price';
import { Decimal } from '@domain/models/primitives/decimal';
import { ExchangeOrderStatus } from '@components/trading/core/domain/models/exchange-order/exchange-order-status';
import { ExchangeCloid } from '@components/trading/core/domain/models/exchange-order/exchange-cloid';
import { DatabaseTestHelper, TEST_USER_ID } from '@/infra/tests/database-test-helper';
import { CacheTestHelper } from '@/infra/tests/cache-test-helper';
import type { DrizzleDb } from '@/infra/database/drizzle-db';
import { AppConfigModule } from '@/config/app-config.module';

type PollingAdapterPrivate = {
    checkOrders(): Promise<void>;
    isProcessing: boolean;
};

describe('OrdersPollingAdapter (Integration)', () => {
    let module: TestingModule;
    let monitor: OrdersPollingAdapter;
    let gridsApi: GridsApiPort;
    let hyperliquidOrderClient: ExchangePort;
    let db: DrizzleDb;

    beforeAll(async () => {
        await initializeTestModule();
    });

    beforeEach(async () => {
        await DatabaseTestHelper.seedTestUser();
    });

    afterEach(async () => {
        await DatabaseTestHelper.cleanup();
        await CacheTestHelper.cleanup();
        vi.clearAllMocks();
    });

    afterAll(async () => {
        if (monitor) {
            monitor.onModuleDestroy();
        }

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
            userId: TEST_USER_ID,
            symbol,
            lowerPrice: 45000,
            upperPrice: 55000,
            levels: 10,
            investmentUSDC: 5000,
            investmentBase: 0.1,
            trailingEnabled: false,
            trailingTriggerPercent: 5,
            trailingStepPercent: 2,
            trailingPartialClosePercent: 50,
            stopLossEnabled: false,
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
        }> = {},
    ): Promise<OrderDto> {
        const orderId = crypto.randomUUID();
        const order = await gridsApi.createOrder({
            id: orderId,
            gridId: grid.id,
            symbol: grid.symbol,
            side: overrides.side ?? OrderSide.Buy,
            type: OrderType.Limit,
            levelIndex: overrides.levelIndex ?? 5,
            price: overrides.price ?? 50000,
            amount: 0.01,
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

    describe('Order Synchronization Flow', () => {
        it('should detect filled orders and refill them', async () => {
            const grid = await createGrid('BTC');
            const order = await createOrder(grid, { exchangeOrderId: '12345' });

            vi.mocked(hyperliquidOrderClient.getOpenSpotOrders).mockResolvedValue([]);

            vi.mocked(hyperliquidOrderClient.getOrderStatus).mockResolvedValue({
                exchangeOrderId: '12345',
                status: ExchangeOrderStatus.FILLED,
                statusTimestamp: Date.now(),
            });

            vi.mocked(hyperliquidOrderClient.placeSpotOrder).mockResolvedValue({
                exchangeOrderId: '67890',
                status: OrderStatus.Placed,
            });

            await (monitor as unknown as PollingAdapterPrivate).checkOrders();

            const updatedOrder = await gridsApi.findOrderByExchangeId('12345');
            expect(updatedOrder?.status).toBe(OrderStatus.Filled);
            expect(updatedOrder?.filledAt).toBeDefined();

            const allOrders = await gridsApi.findActiveOrdersByGridId(grid.id);
            const newOrders = allOrders.filter((o) => o.id !== order.id);
            expect(newOrders.length).toBeGreaterThan(0);
        });

        it('should handle cancelled orders', async () => {
            const grid = await createGrid('ETH', {
                lowerPrice: 2500,
                upperPrice: 3500,
                investmentUSDC: 3000,
                investmentBase: 1,
            });
            await createOrder(grid, {
                side: OrderSide.Sell,
                price: 3000,
                exchangeOrderId: '99999',
            });

            vi.mocked(hyperliquidOrderClient.getOpenSpotOrders).mockResolvedValue([]);

            vi.mocked(hyperliquidOrderClient.getOrderStatus).mockResolvedValue({
                exchangeOrderId: '99999',
                status: ExchangeOrderStatus.CANCELED,
                statusTimestamp: Date.now(),
            });

            await (monitor as unknown as PollingAdapterPrivate).checkOrders();

            const updatedOrder = await gridsApi.findOrderByExchangeId('99999');
            expect(updatedOrder?.status).toBe(OrderStatus.Cancelled);
        });

        it('should mark order Cancelled and re-place on the same level/side when selfTradeCanceled', async () => {
            const grid = await createGrid('BTC');
            const order = await createOrder(grid, {
                side: OrderSide.Buy,
                price: 50000,
                levelIndex: 5,
                exchangeOrderId: '55555',
            });

            vi.mocked(hyperliquidOrderClient.getOpenSpotOrders).mockResolvedValue([]);

            vi.mocked(hyperliquidOrderClient.getOrderStatus).mockResolvedValue({
                exchangeOrderId: '55555',
                status: ExchangeOrderStatus.SELF_TRADE_CANCELED,
                statusTimestamp: Date.now(),
            });

            vi.mocked(hyperliquidOrderClient.placeSpotOrder).mockResolvedValue({
                exchangeOrderId: '55556',
                status: OrderStatus.Placed,
            });

            await (monitor as unknown as PollingAdapterPrivate).checkOrders();

            const cancelledOrder = await gridsApi.findOrderByExchangeId('55555');
            expect(cancelledOrder?.status).toBe(OrderStatus.Cancelled);

            const allOrders = await gridsApi.findActiveOrdersByGridId(grid.id);
            const recovered = allOrders.filter(
                (o) => o.id !== order.id && o.levelIndex === 5 && o.side === OrderSide.Buy,
            );
            expect(recovered.length).toBeGreaterThan(0);
        });

        it('should handle orders still open on exchange', async () => {
            const grid = await createGrid('SOL', {
                lowerPrice: 100,
                upperPrice: 150,
                levels: 5,
                investmentUSDC: 1000,
                investmentBase: 10,
            });
            const order = await createOrder(grid, {
                price: 120,
                exchangeOrderId: '11111',
                levelIndex: 2,
            });

            vi.mocked(hyperliquidOrderClient.getOpenSpotOrders).mockResolvedValue([
                {
                    id: '11111',
                    cloid: ExchangeCloid.create(order.id),
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

            await (monitor as unknown as PollingAdapterPrivate).checkOrders();

            const updatedOrder = await gridsApi.findOrderByExchangeId('11111');
            expect(updatedOrder?.status).toBe(OrderStatus.Placed);
        });
    });

    describe('Error Handling', () => {
        it('should handle Hyperliquid API errors gracefully', async () => {
            await createGrid('AVAX', {
                lowerPrice: 30,
                upperPrice: 40,
                levels: 5,
                investmentUSDC: 500,
                investmentBase: 10,
            });

            vi.mocked(hyperliquidOrderClient.getOpenSpotOrders).mockRejectedValue(
                new Error('Network timeout'),
            );

            await expect(
                (monitor as unknown as PollingAdapterPrivate).checkOrders(),
            ).resolves.toBeUndefined();
        });
    });

    describe('Concurrent Execution Prevention', () => {
        it('should prevent concurrent sync execution', async () => {
            (monitor as unknown as PollingAdapterPrivate).isProcessing = true;

            const spy = vi.spyOn(hyperliquidOrderClient, 'getOpenSpotOrders');

            await (monitor as unknown as PollingAdapterPrivate).checkOrders();

            expect(spy).not.toHaveBeenCalled();

            (monitor as unknown as PollingAdapterPrivate).isProcessing = false;
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

        const moduleBuilder = Test.createTestingModule({
            imports: [
                MockDistributedLockModule,
                ScheduleModule.forRoot(),
                AppConfigModule.forRoot(),
                DatabaseModule,
                HttpModule,
                TradingModule,
            ],
        });

        // UsersApiPort is still required by other providers in TradingModule
        // (CreateAndStartGridUseCase, HyperliquidExchangeAdapter, OrdersRestoreAdapter)
        const mockUsersApi = {
            findUserById: vi.fn().mockResolvedValue(null),
            findUserByChatId: vi.fn(),
            findUserByAccountAddress: vi.fn().mockResolvedValue({
                id: TEST_USER_ID,
                telegramChatId: 100000001,
                accountAddress: '0x0000000000000000000000000000000000000001',
                agentAddress: '0x0000000000000000000000000000000000000002',
                status: UserStatus.Active,
            }),
            findActiveUsers: vi.fn().mockResolvedValue([
                {
                    id: TEST_USER_ID,
                    telegramChatId: 100000001,
                    accountAddress: '0x0000000000000000000000000000000000000001',
                    agentAddress: '0x0000000000000000000000000000000000000002',
                    status: UserStatus.Active,
                },
            ]),
            getAgentPrivateKey: vi
                .fn()
                .mockResolvedValue(
                    '0x0000000000000000000000000000000000000000000000000000000000000001',
                ),
            getAgentPrivateKeyByAccountAddress: vi
                .fn()
                .mockResolvedValue(
                    '0x0000000000000000000000000000000000000000000000000000000000000001',
                ),
            createPendingUser: vi.fn(),
            activateUser: vi.fn(),
            disconnectUser: vi.fn(),
            updateTradeNotificationsEnabled: vi.fn(),
            markAgentExpired: vi.fn().mockResolvedValue({ agentAddress: '0xnewagent' }),
        };

        moduleBuilder.overrideProvider(DRIZZLE_DB).useValue(db);
        moduleBuilder.overrideProvider(EXCHANGE_PORT).useValue(mockHyperliquidOrderClient);
        moduleBuilder.overrideProvider(USERS_API_PORT).useValue(mockUsersApi);

        module = await moduleBuilder.compile();

        monitor = module.get<OrdersPollingAdapter>(OrdersPollingAdapter);
        gridsApi = module.get<GridsApiPort>(GRIDS_API_PORT);
        hyperliquidOrderClient = module.get<ExchangePort>(EXCHANGE_PORT);
    }
});
