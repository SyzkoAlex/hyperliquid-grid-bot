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

describe('OrdersPollingAdapter (Unit)', () => {
    let module: TestingModule;
    let adapter: OrdersPollingAdapter;
    let mockSyncOrders: { execute: ReturnType<typeof vi.fn> };
    let mockLock: DistributedLockPort;

    beforeEach(async () => {
        mockSyncOrders = { execute: vi.fn().mockResolvedValue(undefined) };

        mockLock = {
            tryAcquire: vi.fn(),
            release: vi.fn(),
            extend: vi.fn(),
            withLock: vi.fn(),
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
            ],
        }).compile();

        adapter = module.get(OrdersPollingAdapter);
    });

    describe('checkOrders', () => {
        it('should call use case via lock when lock is acquired', async () => {
            vi.mocked(mockLock.withLock).mockImplementation(async (_name, _ttl, fn) => {
                return fn();
            });

            await (adapter as unknown as { checkOrders(): Promise<void> }).checkOrders();

            expect(mockLock.withLock).toHaveBeenCalledWith(
                'orders-sync',
                30000,
                expect.any(Function),
            );
            expect(mockSyncOrders.execute).toHaveBeenCalledOnce();
        });

        it('should not call use case when lock is not acquired', async () => {
            vi.mocked(mockLock.withLock).mockResolvedValue(null);

            await (adapter as unknown as { checkOrders(): Promise<void> }).checkOrders();

            expect(mockLock.withLock).toHaveBeenCalledOnce();
            expect(mockSyncOrders.execute).not.toHaveBeenCalled();
        });

        it('should not call lock when isProcessing is true', async () => {
            (adapter as unknown as { isProcessing: boolean }).isProcessing = true;

            await (adapter as unknown as { checkOrders(): Promise<void> }).checkOrders();

            expect(mockLock.withLock).not.toHaveBeenCalled();
            expect(mockSyncOrders.execute).not.toHaveBeenCalled();

            (adapter as unknown as { isProcessing: boolean }).isProcessing = false;
        });
    });
});
