import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule, DRIZZLE_DB } from '@infra/database/database.module';
import { EventBusModule } from '@infra/events/event-bus.module';
import { HttpModule } from '@infra/http/http.module';
import { AppConfigModule } from '@infra/config/app-config.module';
import { TradingModule } from '../../trading.module';
import { GridCommandsController } from './grid-commands.controller';
import { HyperliquidOrderClient } from '../../secondary/client/hyperliquid/hyperliquid-order.client';
import { HyperliquidUserEventsClient } from '../../secondary/client/hyperliquid/hyperliquid-user-events.client';
import { PostgresGridRepository } from '../../secondary/repository/grid/postgres-grid.repository';
import { EventBus } from '@infra/events/event-bus.service';
import { EventType } from '@domain/events/event-type';
import { CreateGridCommandEvent } from '@domain/events/create-grid-command.event';
import { GridCreatedSuccessEvent } from '@domain/events/grid-created-success.event';
import { GridCreatedErrorEvent } from '@domain/events/grid-created-error.event';
import { Decimal } from '@domain/primitives/decimal';
import { DatabaseTestHelper } from '@infra/database/database-test-helper';
import { CacheTestHelper } from '@infra/cache/cache-test-helper';

import { UserState } from '../../core/domain/user-state/user-state';
import { AssetPosition } from '../../core/domain/user-state/asset-position';
import { Symbol as TradingSymbol } from '../../core/domain/common/symbol';
import { OrderStatus } from '../../core/domain/order/order-status';

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
    let gridRepository: PostgresGridRepository;
    let hyperliquidOrderClient: HyperliquidOrderClient;
    let eventBus: EventBus;

    const mockChatId = 123456;

    beforeAll(async () => {
        const env = await setupTestEnvironment();
        module = env.module;
        gridRepository = env.gridRepository;
        hyperliquidOrderClient = env.hyperliquidOrderClient;
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

            vi.mocked(hyperliquidOrderClient.getUserSpotState).mockResolvedValue(mockUserState);

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
                chatId: mockChatId,
                symbol: 'BTC',
                lowerPrice: 45000,
                upperPrice: 55000,
                mode: 'neutral',
                levels: 10,
                totalInvestmentUSDC: 10000,
                trailing: false,
            });

            eventBus.publish(command);

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
            expect(successEvent.chatId).toBe(mockChatId);
            expect(successEvent.symbol).toBe('BTC');
            expect(successEvent.mode).toBe('neutral');
            expect(successEvent.lowerPrice).toBe(45000);
            expect(successEvent.upperPrice).toBe(55000);
            expect(successEvent.levels).toBe(10);
        });

        it('should use default values when not provided', async () => {
            // Mock Hyperliquid responses
            const mockUserState = UserState.create({
                withdrawableBalance: Decimal.from(20000),
                assetPositions: [
                    AssetPosition.create({
                        symbol: TradingSymbol.create('USDC'),
                        size: Decimal.from(15000),
                    }),
                    AssetPosition.create({
                        symbol: TradingSymbol.create('ETH'),
                        size: Decimal.from(5),
                    }),
                ],
            });

            vi.mocked(hyperliquidOrderClient.getUserSpotState).mockResolvedValue(mockUserState);

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
                chatId: mockChatId,
                symbol: 'ETH',
                lowerPrice: 3000,
                upperPrice: 4000,
            });

            eventBus.publish(command);

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
            const mockUserState = UserState.create({
                withdrawableBalance: Decimal.from(20000),
                assetPositions: [
                    AssetPosition.create({
                        symbol: TradingSymbol.create('USDC'),
                        size: Decimal.from(15000),
                    }),
                    AssetPosition.create({
                        symbol: TradingSymbol.create('SOL'),
                        size: Decimal.from(100),
                    }),
                ],
            });

            vi.mocked(hyperliquidOrderClient.getUserSpotState).mockResolvedValue(mockUserState);

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
                chatId: mockChatId,
                symbol: 'SOL',
                lowerPrice: 100,
                upperPrice: 150,
                levels: 10,
                trailing: true,
            });

            eventBus.publish(command);

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
            vi.mocked(hyperliquidOrderClient.getUserSpotState).mockRejectedValue(
                new Error('Network timeout'),
            );

            // Subscribe to error events
            const errorHandler = vi.fn();
            eventBus.subscribe(EventType.GridCreatedError, errorHandler);

            const command = CreateGridCommandEvent.create({
                chatId: mockChatId,
                symbol: 'BTC',
                lowerPrice: 45000,
                upperPrice: 55000,
            });

            eventBus.publish(command);

            await new Promise((resolve) => setTimeout(resolve, 1000));

            // Verify error event was published
            expect(errorHandler).toHaveBeenCalledTimes(1);
            const errorEvent = errorHandler.mock.calls[0][0] as GridCreatedErrorEvent;
            expect(errorEvent.chatId).toBe(mockChatId);
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

            vi.mocked(hyperliquidOrderClient.getUserSpotState).mockResolvedValue(mockUserState);

            const errorHandler = vi.fn();
            eventBus.subscribe(EventType.GridCreatedError, errorHandler);

            // Try to create grid with more capital than available
            const command = CreateGridCommandEvent.create({
                chatId: mockChatId,
                symbol: 'BTC',
                lowerPrice: 45000,
                upperPrice: 55000,
                totalInvestmentUSDC: 10000, // More than available balance
            });

            eventBus.publish(command);

            await new Promise((resolve) => setTimeout(resolve, 1000));

            // Verify error event was published
            expect(errorHandler).toHaveBeenCalledTimes(1);
            const errorEvent = errorHandler.mock.calls[0][0] as GridCreatedErrorEvent;
            expect(errorEvent.chatId).toBe(mockChatId);

            // Verify no grid was created
            const grids = await gridRepository.findManyActive();
            expect(grids.length).toBe(0);
        });

        it('should handle order placement failure', async () => {
            const mockUserState = UserState.create({
                withdrawableBalance: Decimal.from(8000),
                assetPositions: [
                    AssetPosition.create({
                        symbol: TradingSymbol.create('USDC'),
                        size: Decimal.from(5000),
                    }),
                ],
            });

            vi.mocked(hyperliquidOrderClient.getUserSpotState).mockResolvedValue(mockUserState);

            // Mock order placement failure
            vi.mocked(hyperliquidOrderClient.placeSpotOrder).mockRejectedValue(
                new Error('Order rejected'),
            );

            const errorHandler = vi.fn();
            eventBus.subscribe(EventType.GridCreatedError, errorHandler);

            const command = CreateGridCommandEvent.create({
                chatId: mockChatId,
                symbol: 'BTC',
                lowerPrice: 45000,
                upperPrice: 55000,
            });

            eventBus.publish(command);

            await new Promise((resolve) => setTimeout(resolve, 1000));

            // Verify error event was published
            expect(errorHandler).toHaveBeenCalledTimes(1);
            const errorEvent = errorHandler.mock.calls[0][0] as GridCreatedErrorEvent;
            expect(errorEvent.chatId).toBe(mockChatId);
            expect(errorEvent.error).toContain(
                'Neutral mode requires both quote and base investment',
            );
        });
    });

    describe('Multiple Grids', () => {
        it('should create multiple grids for different symbols', async () => {
            const mockUserState = UserState.create({
                withdrawableBalance: Decimal.from(30000),
                assetPositions: [
                    AssetPosition.create({
                        symbol: TradingSymbol.create('USDC'),
                        size: Decimal.from(20000),
                    }),
                    AssetPosition.create({
                        symbol: TradingSymbol.create('BTC'),
                        size: Decimal.from(0.3),
                    }),
                    AssetPosition.create({
                        symbol: TradingSymbol.create('ETH'),
                        size: Decimal.from(5),
                    }),
                ],
            });

            vi.mocked(hyperliquidOrderClient.getUserSpotState).mockResolvedValue(mockUserState);

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
                chatId: mockChatId,
                symbol: 'BTC',
                lowerPrice: 45000,
                upperPrice: 55000,
                levels: 5,
            });

            eventBus.publish(command1);

            // Create second grid (ETH)
            const command2 = CreateGridCommandEvent.create({
                chatId: mockChatId,
                symbol: 'ETH',
                lowerPrice: 3000,
                upperPrice: 4000,
                levels: 5,
            });

            eventBus.publish(command2);

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

    // Create mocked Hyperliquid client
    const mockHyperliquidOrderClient = {
        getOpenSpotOrders: vi.fn(),
        getOrderStatus: vi.fn(),
        getUserSpotState: vi.fn(),
        placeSpotOrder: vi.fn(),
        cancelSpotOrder: vi.fn(),
    };

    // Mock websocket client (not needed for this test)
    const mockHyperliquidUserEventsClient = {
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
    moduleBuilder.overrideProvider(HyperliquidOrderClient).useValue(mockHyperliquidOrderClient);
    moduleBuilder
        .overrideProvider(HyperliquidUserEventsClient)
        .useValue(mockHyperliquidUserEventsClient);

    // Compile module
    const module = await moduleBuilder.compile();

    // Get instances from module
    const gridRepository = module.get<PostgresGridRepository>(PostgresGridRepository);
    const hyperliquidOrderClient = module.get<HyperliquidOrderClient>(HyperliquidOrderClient);
    const eventBus = module.get<EventBus>(EventBus);

    // Manually initialize only the GridCommandsController to set up event subscriptions
    // (we don't call module.init() to avoid starting the OrderRestoreMonitor which blocks)
    const gridCommandsConsumer = module.get(GridCommandsController);
    gridCommandsConsumer.onModuleInit();

    return {
        module,
        gridRepository,
        hyperliquidOrderClient,
        eventBus,
        db,
    };
}
