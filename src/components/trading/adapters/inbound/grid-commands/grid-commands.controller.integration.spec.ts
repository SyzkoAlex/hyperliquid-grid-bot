import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule, DRIZZLE_DB } from '@adapters/outbound/database/database.module';
import { EventBusModule } from '@adapters/outbound/events/event-bus.module';
import { HttpModule } from '@/infra/http/http.module';
import { AppConfigModule } from '@/config/app-config.module';
import { TradingModule } from '@components/trading/trading.module';
import { GridCommandsController } from './grid-commands.controller';
import { HyperliquidOrderClientAdapter } from '@components/trading/adapters/outbound/exchange/hyperliquid/hyperliquid-order-client.adapter';
import { HyperliquidInfoClientAdapter } from '@adapters/outbound/hyperliquid/hyperliquid-info-client.adapter';
import { OrderEventsListener } from '@components/trading/adapters/outbound/exchange/hyperliquid/order-events.listener';
import { PostgresGridRepositoryAdapter } from '@components/trading/adapters/outbound/persistence/grid/postgres-grid-repository.adapter';
import { GRID_REPOSITORY_PORT } from '@components/trading/core/application/ports/grid-repository.port';
import { EXCHANGE_CLIENT_PORT } from '@components/trading/core/application/ports/exchange-client.port';
import { EXCHANGE_INFO_PORT } from '@components/trading/core/application/ports/exchange-info.port';
import { EVENT_BUS, EventBus } from '@/infra/events/event-bus.port';
import { CreateGridCommandEvent } from '@domain/models/events/commands/create-grid-command.event';
import { GridCreatedSuccessEvent } from '@domain/models/events/trading/grid-created-success.event';
import { GridCreatedErrorEvent } from '@domain/models/events/trading/grid-created-error.event';
import { EventType } from '@domain/models/events/event-type';
import { Decimal } from '@domain/models/primitives/decimal';
import { DatabaseTestHelper } from '@adapters/outbound/database/database-test-helper';
import { CacheTestHelper } from '@adapters/outbound/cache/cache-test-helper';

import { UserState } from '@domain/models/user-state/user-state';
import { AssetPosition } from '@domain/models/user-state/asset-position';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Price } from '@domain/models/primitives/price';
import { OrderStatus } from '@domain/models/order/order-status';

/**
 * Integration Tests for GridCommandsController
 *
 * Prerequisites:
 * - Docker must be running for testcontainers
 *
 * Run with: pnpm test:integration grid-commands
 */
describe('GridCommandsController (Integration)', () => {
    let module: TestingModule;
    let gridRepository: PostgresGridRepositoryAdapter;
    let hyperliquidOrderClient: HyperliquidOrderClientAdapter;
    let hyperliquidInfoClient: HyperliquidInfoClientAdapter;
    let eventBus: EventBus;

    beforeAll(async () => {
        const env = await setupTestEnvironment();
        module = env.module;
        gridRepository = env.gridRepository;
        hyperliquidOrderClient = env.hyperliquidOrderClient;
        hyperliquidInfoClient = env.hyperliquidInfoClient;
        eventBus = env.eventBus;
    });

    beforeEach(() => {
        // Clear mocks before each test to ensure clean state
        vi.clearAllMocks();
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

            vi.mocked(hyperliquidInfoClient.getCurrentPrice).mockResolvedValue(Price.from(50000));
            vi.mocked(hyperliquidInfoClient.getUserSpotState).mockResolvedValue(mockUserState);

            // Mock successful order placements
            let orderIdCounter = 1;
            vi.mocked(hyperliquidOrderClient.placeSpotOrder).mockImplementation(async () => ({
                exchangeOrderId: `order-${orderIdCounter++}`,
                status: OrderStatus.Placed,
            }));

            // Wait for success event for this specific symbol
            let unsubscribe: (() => void) | undefined;
            const successEventPromise = new Promise<GridCreatedSuccessEvent>((resolve) => {
                unsubscribe = eventBus.subscribe(
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
                mode: 'neutral',
                levels: 10,
                totalInvestmentUSDC: 10000,
                trailing: false,
            });

            await eventBus.publish(command);

            // Wait for success event and ensure grid is fully persisted
            const successEvent = await successEventPromise;
            unsubscribe?.();
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Verify grid was created and saved in database
            const foundGrids = await gridRepository.findManyActive();
            expect(foundGrids.length).toBe(1);

            const grid = foundGrids[0];
            expect(grid.symbol.toString()).toBe('BTC');
            expect(grid.mode).toBe('neutral');
            expect(grid.lowerPrice.toNumber()).toBe(45000);
            expect(grid.upperPrice.toNumber()).toBe(55000);
            expect(grid.levels).toBe(10);
            expect(grid.status).toBe('running');

            // Verify orders were placed
            expect(hyperliquidOrderClient.placeSpotOrder).toHaveBeenCalled();

            // Verify success event data
            expect(successEvent.symbol).toBe('BTC');
            expect(successEvent.mode).toBe('neutral');
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

            vi.mocked(hyperliquidInfoClient.getCurrentPrice).mockResolvedValue(Price.from(3500));
            vi.mocked(hyperliquidInfoClient.getUserSpotState).mockResolvedValue(mockUserState);

            let orderIdCounter = 1;
            vi.mocked(hyperliquidOrderClient.placeSpotOrder).mockImplementation(async () => ({
                exchangeOrderId: `order-${orderIdCounter++}`,
                status: OrderStatus.Placed,
            }));

            // Wait for success event for this specific symbol
            let unsubscribe: (() => void) | undefined;
            const successEventPromise = new Promise<GridCreatedSuccessEvent>((resolve) => {
                unsubscribe = eventBus.subscribe(
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
            });

            await eventBus.publish(command);

            await successEventPromise;
            unsubscribe?.();
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Verify grid was created with defaults
            const grids = await gridRepository.findManyActive();
            expect(grids.length).toBe(1);

            const grid = grids[0];
            expect(grid.mode).toBe('neutral'); // default
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

            vi.mocked(hyperliquidInfoClient.getCurrentPrice).mockResolvedValue(Price.from(125));
            vi.mocked(hyperliquidInfoClient.getUserSpotState).mockResolvedValue(mockUserState);

            let orderIdCounter = 1;
            vi.mocked(hyperliquidOrderClient.placeSpotOrder).mockImplementation(async () => ({
                exchangeOrderId: `order-${orderIdCounter++}`,
                status: OrderStatus.Placed,
            }));

            // Wait for success event for this specific symbol
            let unsubscribe: (() => void) | undefined;
            const successEventPromise = new Promise<GridCreatedSuccessEvent>((resolve) => {
                unsubscribe = eventBus.subscribe(
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
            });

            await eventBus.publish(command);

            await successEventPromise;
            unsubscribe?.();
            await new Promise((resolve) => setTimeout(resolve, 100));

            const grids = await gridRepository.findManyActive();
            expect(grids.length).toBe(1);

            const grid = grids[0];
            expect(grid.trailingEnabled).toBe(true);
        });
    });

    describe('Error Handling', () => {
        it('should publish error event when API fails', async () => {
            // Mock API failure
            vi.mocked(hyperliquidInfoClient.getCurrentPrice).mockRejectedValue(
                new Error('Network timeout'),
            );
            vi.mocked(hyperliquidInfoClient.getUserSpotState).mockRejectedValue(
                new Error('Network timeout'),
            );

            // Subscribe to error events
            const errorHandler = vi.fn();
            eventBus.subscribe(EventType.GridCreatedError, errorHandler);

            const command = CreateGridCommandEvent.create({
                symbol: 'BTC',
                lowerPrice: 45000,
                upperPrice: 55000,
            });

            await eventBus.publish(command);

            await new Promise((resolve) => setTimeout(resolve, 1000));

            // Verify error event was published
            expect(errorHandler).toHaveBeenCalledTimes(1);
            const errorEvent = errorHandler.mock.calls[0][0] as GridCreatedErrorEvent;
            expect(errorEvent.error).toContain('Network timeout');

            // Verify no grid was created
            const grids = await gridRepository.findManyActive();
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

            vi.mocked(hyperliquidInfoClient.getCurrentPrice).mockResolvedValue(Price.from(50000));
            vi.mocked(hyperliquidInfoClient.getUserSpotState).mockResolvedValue(mockUserState);

            const errorHandler = vi.fn();
            eventBus.subscribe(EventType.GridCreatedError, errorHandler);

            // Try to create grid with more capital than available
            const command = CreateGridCommandEvent.create({
                symbol: 'BTC',
                lowerPrice: 45000,
                upperPrice: 55000,
                totalInvestmentUSDC: 10000, // More than available balance
            });

            await eventBus.publish(command);

            await new Promise((resolve) => setTimeout(resolve, 1000));

            // Verify error event was published
            expect(errorHandler).toHaveBeenCalledTimes(1);

            // Verify no grid was created
            const grids = await gridRepository.findManyActive();
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

            vi.mocked(hyperliquidInfoClient.getCurrentPrice).mockResolvedValue(Price.from(50000));
            vi.mocked(hyperliquidInfoClient.getUserSpotState).mockResolvedValue(mockUserState);

            // Mock order placement failure — OrderPlacementService catches individual errors
            // so the grid creation itself succeeds (success event published, not error event)
            vi.mocked(hyperliquidOrderClient.placeSpotOrder).mockRejectedValue(
                new Error('Order rejected'),
            );

            let unsubscribe: (() => void) | undefined;
            const successEventPromise = new Promise<GridCreatedSuccessEvent>((resolve) => {
                unsubscribe = eventBus.subscribe(
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
            });

            await eventBus.publish(command);

            // Grid creation succeeds because OrderPlacementService handles individual
            // order failures gracefully (logs error, continues, returns placedCount=0)
            await successEventPromise;
            unsubscribe?.();
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Verify grid was created despite all orders failing
            const grids = await gridRepository.findManyActive();
            expect(grids.length).toBe(1);

            // Verify order placement was attempted
            expect(hyperliquidOrderClient.placeSpotOrder).toHaveBeenCalled();
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
            vi.mocked(hyperliquidInfoClient.getCurrentPrice).mockImplementation(async (symbol) => {
                if (symbol.toString() === 'BTC') return Price.from(50000);
                if (symbol.toString() === 'ETH') return Price.from(3500);
                return Price.from(100);
            });
            vi.mocked(hyperliquidInfoClient.getUserSpotState).mockResolvedValue(mockUserState);

            let orderIdCounter = 1;
            vi.mocked(hyperliquidOrderClient.placeSpotOrder).mockImplementation(async () => ({
                exchangeOrderId: `order-${orderIdCounter++}`,
                status: OrderStatus.Placed,
            }));

            // Wait for both success events (BTC and ETH only)
            const successEvents: GridCreatedSuccessEvent[] = [];
            let unsubscribe: (() => void) | undefined;
            const successPromise = new Promise<void>((resolve) => {
                unsubscribe = eventBus.subscribe(
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
            });

            await eventBus.publish(command1);

            // Create second grid (ETH)
            const command2 = CreateGridCommandEvent.create({
                symbol: 'ETH',
                lowerPrice: 3000,
                upperPrice: 4000,
                levels: 5,
            });

            await eventBus.publish(command2);

            // Wait for both grids to be created
            await successPromise;
            unsubscribe?.();
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Verify both grids were created
            const grids = await gridRepository.findManyActive();
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
    const mockHyperliquidOrderClient = {
        getOpenSpotOrders: vi.fn(),
        getOrderStatus: vi.fn(),
        placeSpotOrder: vi.fn(),
        cancelSpotOrder: vi.fn(),
    };

    const mockHyperliquidInfoClient = {
        getUserSpotState: vi.fn(),
        getCurrentPrice: vi.fn(),
    };

    // Mock websocket client (not needed for this test)
    const mockOrderEventsListener = {
        onModuleInit: vi.fn(),
        onModuleDestroy: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        onFill: vi.fn(() => () => {}),
        onOrderStatus: vi.fn(() => () => {}),
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
    moduleBuilder.overrideProvider(EXCHANGE_INFO_PORT).useValue(mockHyperliquidInfoClient);
    moduleBuilder.overrideProvider(OrderEventsListener).useValue(mockOrderEventsListener);

    // Compile module
    const module = await moduleBuilder.compile();

    // Get instances from module
    const gridRepository = module.get<PostgresGridRepositoryAdapter>(GRID_REPOSITORY_PORT);
    const hyperliquidOrderClient = module.get<HyperliquidOrderClientAdapter>(EXCHANGE_CLIENT_PORT);
    const hyperliquidInfoClient = module.get<HyperliquidInfoClientAdapter>(EXCHANGE_INFO_PORT);
    const eventBus = module.get<EventBus>(EVENT_BUS);

    // Manually initialize only the GridCommandsController to set up event subscriptions
    // (we don't call module.init() to avoid starting the OrderRestoreMonitor which blocks)
    const gridCommandsConsumer = module.get(GridCommandsController);
    gridCommandsConsumer.onModuleInit();

    return {
        module,
        gridRepository,
        hyperliquidOrderClient,
        hyperliquidInfoClient,
        eventBus,
        db,
    };
}
