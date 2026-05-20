import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { OrdersPollingAdapter } from './orders-polling.adapter';
import { SyncOrdersUseCase } from '@components/trading/core/application/use-cases/sync-orders/sync-orders.use-case';
import {
    DISTRIBUTED_LOCK_PORT,
    DistributedLockPort,
} from '@/core/application/ports/outbound/distributed-lock.port';
import { GRIDS_API_PORT } from '@components/grids/api/grids-api.port';
import { EXCHANGE_PORT } from '@components/trading/core/application/ports/exchange.port';
import { GridStatus } from '@domain/models/grid/grid-status';
import { SymbolPriceFetcherService } from '@components/trading/core/application/services/symbol-price-fetcher/symbol-price-fetcher.service';

describe('OrdersPollingAdapter (Unit)', () => {
    let module: TestingModule;
    let adapter: OrdersPollingAdapter;
    let mockSyncOrders: { executeForGrids: ReturnType<typeof vi.fn> };
    let mockLock: DistributedLockPort;
    let mockGridsApi: { findActiveGridsByCursor: ReturnType<typeof vi.fn> };
    let mockExchange: {
        getOpenSpotOrders: ReturnType<typeof vi.fn>;
    };
    let mockPriceFetcher: { fetchPrices: ReturnType<typeof vi.fn> };

    beforeEach(async () => {
        mockSyncOrders = { executeForGrids: vi.fn().mockResolvedValue(undefined) };

        mockLock = {
            tryAcquire: vi.fn(),
            release: vi.fn(),
            extend: vi.fn(),
            withLock: vi.fn(),
        };

        mockGridsApi = {
            findActiveGridsByCursor: vi.fn().mockResolvedValue([]),
        };

        mockExchange = {
            getOpenSpotOrders: vi.fn().mockResolvedValue([]),
        };

        mockPriceFetcher = {
            fetchPrices: vi.fn().mockResolvedValue(new Map([['BTC', 50000]])),
        };

        module = await Test.createTestingModule({
            imports: [ScheduleModule.forRoot()],
            providers: [
                OrdersPollingAdapter,
                { provide: SyncOrdersUseCase, useValue: mockSyncOrders },
                { provide: DISTRIBUTED_LOCK_PORT, useValue: mockLock },
                {
                    provide: ConfigService,
                    useValue: {
                        get: () => ({ pollIntervalMs: 60000, syncLockTtlMs: 30000 }),
                    },
                },
                { provide: GRIDS_API_PORT, useValue: mockGridsApi },
                { provide: EXCHANGE_PORT, useValue: mockExchange },
                { provide: SymbolPriceFetcherService, useValue: mockPriceFetcher },
            ],
        }).compile();

        adapter = module.get(OrdersPollingAdapter);
    });

    describe('checkOrders', () => {
        it('should call syncAllActiveGrids via lock when lock is acquired', async () => {
            vi.mocked(mockLock.withLock).mockImplementation(async (_name, _ttl, fn) => {
                return fn();
            });

            await (adapter as unknown as { checkOrders(): Promise<void> }).checkOrders();

            expect(mockLock.withLock).toHaveBeenCalledWith(
                'orders-sync',
                30000,
                expect.any(Function),
            );
            expect(mockGridsApi.findActiveGridsByCursor).toHaveBeenCalledWith(null, 100);
        });

        it('should not call grids api when lock is not acquired', async () => {
            vi.mocked(mockLock.withLock).mockResolvedValue(null);

            await (adapter as unknown as { checkOrders(): Promise<void> }).checkOrders();

            expect(mockLock.withLock).toHaveBeenCalledOnce();
            expect(mockGridsApi.findActiveGridsByCursor).not.toHaveBeenCalled();
        });

        it('should not call lock when isProcessing is true', async () => {
            (adapter as unknown as { isProcessing: boolean }).isProcessing = true;

            await (adapter as unknown as { checkOrders(): Promise<void> }).checkOrders();

            expect(mockLock.withLock).not.toHaveBeenCalled();
            expect(mockGridsApi.findActiveGridsByCursor).not.toHaveBeenCalled();

            (adapter as unknown as { isProcessing: boolean }).isProcessing = false;
        });
    });

    describe('syncAllActiveGrids', () => {
        it('should stop loop when batch is empty', async () => {
            mockGridsApi.findActiveGridsByCursor.mockResolvedValue([]);

            await (
                adapter as unknown as { syncAllActiveGrids(): Promise<void> }
            ).syncAllActiveGrids();

            expect(mockGridsApi.findActiveGridsByCursor).toHaveBeenCalledOnce();
            expect(mockSyncOrders.executeForGrids).not.toHaveBeenCalled();
        });

        it('should process batch and stop when batch is smaller than BATCH_SIZE', async () => {
            const grid = {
                id: 'grid-uuid-1',
                userId: 'user-1',
                symbol: 'BTC',
                status: GridStatus.Running,
                lowerPrice: 45000,
                upperPrice: 55000,
                levels: 10,
                investmentUSDC: 1000,
                investmentBase: 0,
                trailingEnabled: false,
                trailingTriggerPercent: 5,
                trailingStepPercent: 2,
                trailingPartialClosePercent: 50,
                stopLossEnabled: false,
            };

            // Single item batch — less than BATCH_SIZE=100, loop terminates after first call
            mockGridsApi.findActiveGridsByCursor.mockResolvedValueOnce([
                { grid, accountAddress: '0xacc1' },
            ]);

            mockExchange.getOpenSpotOrders.mockResolvedValue([]);

            await (
                adapter as unknown as { syncAllActiveGrids(): Promise<void> }
            ).syncAllActiveGrids();

            expect(mockGridsApi.findActiveGridsByCursor).toHaveBeenCalledOnce();
            expect(mockGridsApi.findActiveGridsByCursor).toHaveBeenCalledWith(null, 100);
            expect(mockSyncOrders.executeForGrids).toHaveBeenCalledOnce();
        });

        it('should advance cursor and make a second call when full batch is returned', async () => {
            const makeGrid = (id: string) => ({
                id,
                userId: 'user-1',
                symbol: 'BTC',
                status: GridStatus.Running,
                lowerPrice: 45000,
                upperPrice: 55000,
                levels: 10,
                investmentUSDC: 1000,
                investmentBase: 0,
                trailingEnabled: false,
                trailingTriggerPercent: 5,
                trailingStepPercent: 2,
                trailingPartialClosePercent: 50,
                stopLossEnabled: false,
            });

            // First batch is full (100 items), second batch is empty
            const fullBatch = Array.from({ length: 100 }, (_, i) => ({
                grid: makeGrid(`grid-uuid-${String(i).padStart(3, '0')}`),
                accountAddress: '0xacc1',
            }));

            mockGridsApi.findActiveGridsByCursor
                .mockResolvedValueOnce(fullBatch)
                .mockResolvedValueOnce([]);

            mockExchange.getOpenSpotOrders.mockResolvedValue([]);

            await (
                adapter as unknown as { syncAllActiveGrids(): Promise<void> }
            ).syncAllActiveGrids();

            expect(mockGridsApi.findActiveGridsByCursor).toHaveBeenCalledTimes(2);
            expect(mockGridsApi.findActiveGridsByCursor).toHaveBeenNthCalledWith(1, null, 100);
            expect(mockGridsApi.findActiveGridsByCursor).toHaveBeenNthCalledWith(
                2,
                'grid-uuid-099',
                100,
            );
        });

        it('should deduplicate exchange calls per accountAddress', async () => {
            const grid1 = {
                id: 'grid-uuid-1',
                userId: 'user-1',
                symbol: 'BTC',
                status: GridStatus.Running,
                lowerPrice: 45000,
                upperPrice: 55000,
                levels: 10,
                investmentUSDC: 1000,
                investmentBase: 0,
                trailingEnabled: false,
                trailingTriggerPercent: 5,
                trailingStepPercent: 2,
                trailingPartialClosePercent: 50,
                stopLossEnabled: false,
            };
            const grid2 = { ...grid1, id: 'grid-uuid-2' };

            mockGridsApi.findActiveGridsByCursor.mockResolvedValueOnce([
                { grid: grid1, accountAddress: '0xacc1' },
                { grid: grid2, accountAddress: '0xacc1' },
            ]);

            mockExchange.getOpenSpotOrders.mockResolvedValue([]);

            await (
                adapter as unknown as { syncAllActiveGrids(): Promise<void> }
            ).syncAllActiveGrids();

            // Only one HTTP call for the same accountAddress
            expect(mockExchange.getOpenSpotOrders).toHaveBeenCalledOnce();
            expect(mockExchange.getOpenSpotOrders).toHaveBeenCalledWith('0xacc1');
            // Both grids passed in one call, with price map
            expect(mockSyncOrders.executeForGrids).toHaveBeenCalledWith(
                '0xacc1',
                [grid1, grid2],
                [],
                expect.any(Map),
            );
        });
    });
});
