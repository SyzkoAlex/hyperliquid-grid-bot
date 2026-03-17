import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { OrdersRestoreAdapter } from './orders-restore.adapter';
import { RestoreOrdersUseCase } from '@components/trading/core/application/use-cases/restore-orders/restore-orders.use-case';
import {
    DISTRIBUTED_LOCK_PORT,
    DistributedLockPort,
} from '@/core/application/ports/outbound/distributed-lock.port';

describe('OrdersRestoreAdapter (Unit)', () => {
    let module: TestingModule;
    let adapter: OrdersRestoreAdapter;
    let mockRestoreOrders: { execute: ReturnType<typeof vi.fn> };
    let mockLock: DistributedLockPort;

    beforeEach(async () => {
        mockRestoreOrders = {
            execute: vi.fn().mockResolvedValue({ hasErrors: false, errors: [] }),
        };

        mockLock = {
            tryAcquire: vi.fn(),
            release: vi.fn(),
            extend: vi.fn(),
            withLock: vi.fn(),
        };

        module = await Test.createTestingModule({
            imports: [ScheduleModule.forRoot()],
            providers: [
                OrdersRestoreAdapter,
                { provide: RestoreOrdersUseCase, useValue: mockRestoreOrders },
                { provide: DISTRIBUTED_LOCK_PORT, useValue: mockLock },
                {
                    provide: ConfigService,
                    useValue: {
                        get: () => ({ recoveryIntervalMs: 60000, restoreLockTtlMs: 60000 }),
                    },
                },
            ],
        }).compile();

        adapter = module.get(OrdersRestoreAdapter);
    });

    describe('runRestore', () => {
        it('should call use case via lock when lock is acquired', async () => {
            vi.mocked(mockLock.withLock).mockImplementation(async (_name, _ttl, fn) => {
                return fn();
            });

            await (adapter as unknown as { runRestore(): Promise<void> }).runRestore();

            expect(mockLock.withLock).toHaveBeenCalledWith(
                'orders-restore',
                60000,
                expect.any(Function),
            );
            expect(mockRestoreOrders.execute).toHaveBeenCalledOnce();
        });

        it('should not call use case when lock is not acquired', async () => {
            vi.mocked(mockLock.withLock).mockResolvedValue(null);

            await (adapter as unknown as { runRestore(): Promise<void> }).runRestore();

            expect(mockLock.withLock).toHaveBeenCalledOnce();
            expect(mockRestoreOrders.execute).not.toHaveBeenCalled();
        });

        it('should not call lock when isRunning is true', async () => {
            (adapter as unknown as { isRunning: boolean }).isRunning = true;

            await (adapter as unknown as { runRestore(): Promise<void> }).runRestore();

            expect(mockLock.withLock).not.toHaveBeenCalled();
            expect(mockRestoreOrders.execute).not.toHaveBeenCalled();

            (adapter as unknown as { isRunning: boolean }).isRunning = false;
        });
    });
});
