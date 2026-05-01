import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule, DRIZZLE_DB } from '@/infra/database/database.module';
import { HttpModule } from '@/infra/http/http.module';
import { AppConfigModule } from '@/config/app-config.module';
import { TradingModule } from '@components/trading/trading.module';
import { GridCommandsAdapter } from './grid-commands.adapter';
import { MockDistributedLockModule } from '@/infra/tests/mock-distributed-lock.module';
import { GRIDS_API_PORT, GridsApiPort } from '@components/grids/api/grids-api.port';
import {
    EXCHANGE_PORT,
    ExchangePort,
} from '@components/trading/core/application/ports/exchange.port';
import {
    EVENT_PUBLISHER_PORT,
    EventPublisherPort,
} from '@/core/application/ports/outbound/event-publisher.port';
import {
    EVENT_SUBSCRIBER_PORT,
    EventSubscriberPort,
} from '@/core/application/ports/inbound/event-subscriber.port';
import { CreateGridCommandEvent } from '@domain/models/events/commands/create-grid-command.event';
import { GridCreatedSuccessEvent } from '@domain/models/events/trading/grid-created-success.event';
import { GridCreatedErrorEvent } from '@domain/models/events/trading/grid-created-error.event';
import { EventType } from '@domain/models/events/event-type';
import { Decimal } from '@domain/models/primitives/decimal';
import { DatabaseTestHelper, TEST_USER_ID } from '@/infra/tests/database-test-helper';
import { CacheTestHelper } from '@/infra/tests/cache-test-helper';
import { USERS_API_PORT } from '@components/users/api/users-api.port';
import { UserStatus } from '@domain/models/user/user-status';

import { UserState } from '@components/trading/core/domain/models/user-state/user-state';
import { AssetPosition } from '@components/trading/core/domain/models/user-state/asset-position';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Price } from '@domain/models/primitives/price';
import { OrderStatus } from '@domain/models/order/order-status';
import { GridStatus } from '@domain/models/grid/grid-status';

/**
 * Integration Tests for GridCommandsAdapter
 *
 * Prerequisites:
 * - Docker must be running for testcontainers
 *
 * Run with: pnpm test:integration grid-commands
 */
describe('GridCommandsAdapter (Integration)', () => {
    let module: TestingModule;
    let gridsApi: GridsApiPort;
    let exchange: ExchangePort;
    let publisher: EventPublisherPort;
    let subscriber: EventSubscriberPort;

    beforeAll(async () => {
        const env = await setupTestEnvironment();
        module = env.module;
        gridsApi = env.gridsApi;
        exchange = env.exchange;
        publisher = env.publisher;
        subscriber = env.subscriber;
    });

    beforeEach(async () => {
        vi.clearAllMocks();
        await DatabaseTestHelper.seedTestUser({ accountAddress: '0xtest' });
    });

    afterEach(async () => {
        // Clean up test data after each test
        await DatabaseTestHelper.cleanup();
        await CacheTestHelper.cleanup();
    });

    afterAll(async () => {
        // Close module
        if (module) {
            await module.close();
        }

        // Close testcontainers
        await DatabaseTestHelper.close();
        await CacheTestHelper.close();
    });

    describe('Grid Creation Flow', () => {
        it('should create and start grid successfully', async () => {
            // Mock Hyperliquid responses
            const mockUserState = UserState.create({
                withdrawableBalance: Decimal.from(15000),
                assetPositions: [
                    AssetPosition.create({
                        symbol: TradingSymbol.create('USDC'),
                        size: Decimal.from(10000),
                    }),
                    AssetPosition.create({
                        symbol: TradingSymbol.create('BTC'),
                        size: Decimal.from(0.2),
                    }),
                ],
            });

            vi.mocked(exchange.getCurrentPrice).mockResolvedValue(Price.from(50000));
            vi.mocked(exchange.getUserSpotState).mockResolvedValue(mockUserState);

            // Mock successful order placements
            let orderIdCounter = 1;
            vi.mocked(exchange.placeSpotOrder).mockImplementation(async () => ({
                exchangeOrderId: `order-${orderIdCounter++}`,
                status: OrderStatus.Placed,
            }));

            // Wait for success event for this specific symbol
            let unsubscribe: (() => void) | undefined;
            const successEventPromise = new Promise<GridCreatedSuccessEvent>((resolve) => {
                unsubscribe = subscriber.subscribe(
                    EventType.GridCreatedSuccess,
                    (event: GridCreatedSuccessEvent) => {
                        if (event.symbol === 'BTC') {
                            resolve(event);
                        }
                    },
                );
            });

            // Create and publish command
            const command = CreateGridCommandEvent.create({
                symbol: 'BTC',
                lowerPrice: 45000,
                upperPrice: 55000,
                levels: 10,
                totalInvestmentUSDC: 10000,
                trailing: false,
                accountAddress: '0xtest',
            });

            await publisher.publish(command);

            // Wait for success event and ensure grid is fully persisted
            const successEvent = await successEventPromise;
            unsubscribe?.();
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Verify grid was created and saved in database
            const foundGrids = await gridsApi.findActiveGrids();
            expect(foundGrids.length).toBe(1);

            const grid = foundGrids[0];
            expect(grid.symbol).toBe('BTC');
            expect(grid.lowerPrice).toBe(45000);
            expect(grid.upperPrice).toBe(55000);
            expect(grid.levels).toBe(10);
            expect(grid.status).toBe(GridStatus.Running);

            // Verify orders were placed
            expect(exchange.placeSpotOrder).toHaveBeenCalled();

            // Verify success event data
            expect(successEvent.symbol).toBe('BTC');
            expect(successEvent.lowerPrice).toBe(45000);
            expect(successEvent.upperPrice).toBe(55000);
            expect(successEvent.levels).toBe(10);
        });

        it('should use default values when not provided', async () => {
            // Mock Hyperliquid responses
            // For neutral mode with auto-calculated total (no totalInvestmentUSDC):
            //   total = withdrawableBalance + eth * price = 17500 + 5*3500 = 35000
            //   investmentUSDC = 17500, investmentBase = 5 — exactly balanced
            const mockUserState = UserState.create({
                withdrawableBalance: Decimal.from(17500),
                assetPositions: [
                    AssetPosition.create({
                        symbol: TradingSymbol.create('USDC'),
                        size: Decimal.from(17500),
                    }),
                    AssetPosition.create({
                        symbol: TradingSymbol.create('ETH'),
                        size: Decimal.from(5),
                    }),
                ],
            });

            vi.mocked(exchange.getCurrentPrice).mockResolvedValue(Price.from(3500));
            vi.mocked(exchange.getUserSpotState).mockResolvedValue(mockUserState);

            let orderIdCounter = 1;
            vi.mocked(exchange.placeSpotOrder).mockImplementation(async () => ({
                exchangeOrderId: `order-${orderIdCounter++}`,
                status: OrderStatus.Placed,
            }));

            // Wait for success event for this specific symbol
            let unsubscribe: (() => void) | undefined;
            const successEventPromise = new Promise<GridCreatedSuccessEvent>((resolve) => {
                unsubscribe = subscriber.subscribe(
                    EventType.GridCreatedSuccess,
                    (event: GridCreatedSuccessEvent) => {
                        if (event.symbol === 'ETH') {
                            resolve(event);
                        }
                    },
                );
            });

            // Command with only required params (uses defaults)
            const command = CreateGridCommandEvent.create({
                symbol: 'ETH',
                lowerPrice: 3000,
                upperPrice: 4000,
                accountAddress: '0xtest',
            });

            await publisher.publish(command);

            await successEventPromise;
            unsubscribe?.();
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Verify grid was created with defaults
            const grids = await gridsApi.findActiveGrids();
            expect(grids.length).toBe(1);

            const grid = grids[0];
            expect(grid.levels).toBe(20); // default
            expect(grid.trailingEnabled).toBe(false); // default
        });

        it('should create grid with trailing enabled', async () => {
            // For neutral mode with auto-calculated total (no totalInvestmentUSDC):
            //   total = withdrawableBalance + sol * price = 12500 + 100*125 = 25000
            //   investmentUSDC = 12500, investmentBase = 100 — exactly balanced
            const mockUserState = UserState.create({
                withdrawableBalance: Decimal.from(12500),
                assetPositions: [
                    AssetPosition.create({
                        symbol: TradingSymbol.create('USDC'),
                        size: Decimal.from(12500),
                    }),
                    AssetPosition.create({
                        symbol: TradingSymbol.create('SOL'),
                        size: Decimal.from(100),
                    }),
                ],
            });

            vi.mocked(exchange.getCurrentPrice).mockResolvedValue(Price.from(125));
            vi.mocked(exchange.getUserSpotState).mockResolvedValue(mockUserState);

            let orderIdCounter = 1;
            vi.mocked(exchange.placeSpotOrder).mockImplementation(async () => ({
                exchangeOrderId: `order-${orderIdCounter++}`,
                status: OrderStatus.Placed,
            }));

            // Wait for success event for this specific symbol
            let unsubscribe: (() => void) | undefined;
            const successEventPromise = new Promise<GridCreatedSuccessEvent>((resolve) => {
                unsubscribe = subscriber.subscribe(
                    EventType.GridCreatedSuccess,
                    (event: GridCreatedSuccessEvent) => {
                        if (event.symbol === 'SOL') {
                            resolve(event);
                        }
                    },
                );
            });

            const command = CreateGridCommandEvent.create({
                symbol: 'SOL',
                lowerPrice: 100,
                upperPrice: 150,
                levels: 10,
                trailing: true,
                accountAddress: '0xtest',
            });

            await publisher.publish(command);

            await successEventPromise;
            unsubscribe?.();
            await new Promise((resolve) => setTimeout(resolve, 100));

            const grids = await gridsApi.findActiveGrids();
            expect(grids.length).toBe(1);

            const grid = grids[0];
            expect(grid.trailingEnabled).toBe(true);
        });
    });

    describe('Error Handling', () => {
        it('should publish error event when API fails', async () => {
            // Mock API failure
            vi.mocked(exchange.getCurrentPrice).mockRejectedValue(new Error('Network timeout'));
            vi.mocked(exchange.getUserSpotState).mockRejectedValue(new Error('Network timeout'));

            // Subscribe to error events
            const errorHandler = vi.fn();
            subscriber.subscribe(EventType.GridCreatedError, errorHandler);

            const command = CreateGridCommandEvent.create({
                symbol: 'BTC',
                lowerPrice: 45000,
                upperPrice: 55000,
                accountAddress: '0xtest',
            });

            await publisher.publish(command);

            await new Promise((resolve) => setTimeout(resolve, 1000));

            // Verify error event was published
            expect(errorHandler).toHaveBeenCalledTimes(1);
            const errorEvent = errorHandler.mock.calls[0][0] as GridCreatedErrorEvent;
            expect(errorEvent.error).toContain('Network timeout');

            // Verify no grid was created
            const grids = await gridsApi.findActiveGrids();
            expect(grids.length).toBe(0);
        });

        it('should handle insufficient balance error', async () => {
            // Mock user state with insufficient balance
            const mockUserState = UserState.create({
                withdrawableBalance: Decimal.from(50),
                assetPositions: [
                    AssetPosition.create({
                        symbol: TradingSymbol.create('USDC'),
                        size: Decimal.from(50),
                    }),
                ],
            });

            vi.mocked(exchange.getCurrentPrice).mockResolvedValue(Price.from(50000));
            vi.mocked(exchange.getUserSpotState).mockResolvedValue(mockUserState);

            const errorHandler = vi.fn();
            subscriber.subscribe(EventType.GridCreatedError, errorHandler);

            // Try to create grid with more capital than available
            const command = CreateGridCommandEvent.create({
                symbol: 'BTC',
                lowerPrice: 45000,
                upperPrice: 55000,
                totalInvestmentUSDC: 10000, // More than available balance
                accountAddress: '0xtest',
            });

            await publisher.publish(command);

            await new Promise((resolve) => setTimeout(resolve, 1000));

            // Verify error event was published
            expect(errorHandler).toHaveBeenCalledTimes(1);

            // Verify no grid was created
            const grids = await gridsApi.findActiveGrids();
            expect(grids.length).toBe(0);
        });

        it('should handle order placement failure gracefully', async () => {
            // For neutral mode with auto-calculated total (no totalInvestmentUSDC):
            //   total = withdrawableBalance + btc * price = 4000 + 0.08*50000 = 8000
            //   investmentUSDC = 4000, investmentBase = 0.08 — exactly balanced
            const mockUserState = UserState.create({
                withdrawableBalance: Decimal.from(4000),
                assetPositions: [
                    AssetPosition.create({
                        symbol: TradingSymbol.create('USDC'),
                        size: Decimal.from(4000),
                    }),
                    AssetPosition.create({
                        symbol: TradingSymbol.create('BTC'),
                        size: Decimal.from(0.08),
                    }),
                ],
            });

            vi.mocked(exchange.getCurrentPrice).mockResolvedValue(Price.from(50000));
            vi.mocked(exchange.getUserSpotState).mockResolvedValue(mockUserState);

            // Mock order placement failure — OrderPlacementService catches individual errors
            // so the grid creation itself succeeds (success event published, not error event)
            vi.mocked(exchange.placeSpotOrder).mockRejectedValue(new Error('Order rejected'));

            let unsubscribe: (() => void) | undefined;
            const successEventPromise = new Promise<GridCreatedSuccessEvent>((resolve) => {
                unsubscribe = subscriber.subscribe(
                    EventType.GridCreatedSuccess,
                    (event: GridCreatedSuccessEvent) => {
                        if (event.symbol === 'BTC') {
                            resolve(event);
                        }
                    },
                );
            });

            const command = CreateGridCommandEvent.create({
                symbol: 'BTC',
                lowerPrice: 45000,
                upperPrice: 55000,
                accountAddress: '0xtest',
            });

            await publisher.publish(command);

            // Grid creation succeeds because OrderPlacementService handles individual
            // order failures gracefully (logs error, continues, returns placedCount=0)
            await successEventPromise;
            unsubscribe?.();
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Verify grid was created despite all orders failing
            const grids = await gridsApi.findActiveGrids();
            expect(grids.length).toBe(1);

            // Verify order placement was attempted
            expect(exchange.placeSpotOrder).toHaveBeenCalled();
        });
    });

    describe('Multiple Grids', () => {
        it('should create multiple grids for different symbols', async () => {
            // For neutral mode with auto-calculated total (no totalInvestmentUSDC):
            //   BTC: total = 35000 + 0.7*50000 = 70000, investmentUSDC=35000, investmentBase=0.7 — balanced
            //   ETH: total = 35000 + 10*3500 = 70000, investmentUSDC=35000, investmentBase=10 — balanced
            const mockUserState = UserState.create({
                withdrawableBalance: Decimal.from(35000),
                assetPositions: [
                    AssetPosition.create({
                        symbol: TradingSymbol.create('USDC'),
                        size: Decimal.from(35000),
                    }),
                    AssetPosition.create({
                        symbol: TradingSymbol.create('BTC'),
                        size: Decimal.from(0.7),
                    }),
                    AssetPosition.create({
                        symbol: TradingSymbol.create('ETH'),
                        size: Decimal.from(10),
                    }),
                ],
            });

            // Mock different prices for different symbols
            vi.mocked(exchange.getCurrentPrice).mockImplementation(async (symbol) => {
                if (symbol.toString() === 'BTC') return Price.from(50000);
                if (symbol.toString() === 'ETH') return Price.from(3500);
                return Price.from(100);
            });
            vi.mocked(exchange.getUserSpotState).mockResolvedValue(mockUserState);

            let orderIdCounter = 1;
            vi.mocked(exchange.placeSpotOrder).mockImplementation(async () => ({
                exchangeOrderId: `order-${orderIdCounter++}`,
                status: OrderStatus.Placed,
            }));

            // Wait for both success events (BTC and ETH only)
            const successEvents: GridCreatedSuccessEvent[] = [];
            let unsubscribe: (() => void) | undefined;
            const successPromise = new Promise<void>((resolve) => {
                unsubscribe = subscriber.subscribe(
                    EventType.GridCreatedSuccess,
                    (event: GridCreatedSuccessEvent) => {
                        if (event.symbol === 'BTC' || event.symbol === 'ETH') {
                            successEvents.push(event);
                            if (successEvents.length === 2) {
                                resolve();
                            }
                        }
                    },
                );
            });

            // Create first grid (BTC)
            const command1 = CreateGridCommandEvent.create({
                symbol: 'BTC',
                lowerPrice: 45000,
                upperPrice: 55000,
                levels: 5,
                accountAddress: '0xtest',
            });

            await publisher.publish(command1);

            // Create second grid (ETH)
            const command2 = CreateGridCommandEvent.create({
                symbol: 'ETH',
                lowerPrice: 3000,
                upperPrice: 4000,
                levels: 5,
                accountAddress: '0xtest',
            });

            await publisher.publish(command2);

            // Wait for both grids to be created
            await successPromise;
            unsubscribe?.();
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Verify both grids were created
            const grids = await gridsApi.findActiveGrids();
            expect(grids.length).toBe(2);

            const symbols = grids.map((g) => g.symbol.toString()).sort();
            expect(symbols).toEqual(['BTC', 'ETH']);
        });
    });
});

/**
 * Sets up the test environment with all necessary dependencies
 * Initializes testcontainers, creates mocked clients, and compiles NestJS module
 */
async function setupTestEnvironment() {
    // Initialize testcontainers
    const db = await DatabaseTestHelper.initialize();
    await CacheTestHelper.initialize();

    // Create mocked Hyperliquid clients
    const mockExchange = {
        getOpenSpotOrders: vi.fn(),
        getOrderStatus: vi.fn(),
        placeSpotOrder: vi.fn(),
        cancelSpotOrder: vi.fn(),
        getUserSpotState: vi.fn(),
        getCurrentPrice: vi.fn(),
        pairExists: vi.fn(),
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

    const mockUsersApi = {
        findUserByChatId: vi.fn(),
        findUserByAccountAddress: vi.fn().mockResolvedValue({
            id: TEST_USER_ID,
            telegramChatId: 100000001,
            accountAddress: '0xtest',
            agentAddress: '0x0000000000000000000000000000000000000002',
            status: UserStatus.Active,
        }),
        findActiveUsers: vi.fn().mockResolvedValue([
            {
                id: TEST_USER_ID,
                telegramChatId: 100000001,
                accountAddress: '0xtest',
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
    };

    moduleBuilder.overrideProvider(DRIZZLE_DB).useValue(db);
    moduleBuilder.overrideProvider(EXCHANGE_PORT).useValue(mockExchange);
    moduleBuilder.overrideProvider(USERS_API_PORT).useValue(mockUsersApi);

    // Compile module
    const module = await moduleBuilder.compile();

    const gridsApi = module.get<GridsApiPort>(GRIDS_API_PORT);
    const exchange = module.get<ExchangePort>(EXCHANGE_PORT);
    const publisher = module.get<EventPublisherPort>(EVENT_PUBLISHER_PORT);
    const subscriber = module.get<EventSubscriberPort>(EVENT_SUBSCRIBER_PORT);

    // Manually initialize only the GridCommandsAdapter to set up event subscriptions
    // (we don't call module.init() to avoid starting the OrderRestoreMonitor which blocks)
    const gridCommandsConsumer = module.get(GridCommandsAdapter);
    gridCommandsConsumer.onModuleInit();

    return {
        module,
        gridsApi,
        exchange,
        publisher,
        subscriber,
        db,
    };
}
