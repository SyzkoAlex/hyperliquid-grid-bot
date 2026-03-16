import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import {
    DISTRIBUTED_LOCK_PORT,
    DistributedLockPort,
} from '@/core/application/ports/outbound/distributed-lock.port';
import { ManagedLockService } from './managed-lock.service';

const LOCK_NAME = 'test-lock';
const TTL_MS = 9000;
const HANDLE = { lockName: LOCK_NAME, ownerId: 'owner-1' };

/** Flush pending microtasks from fire-and-forget async calls */
const flushAsync = () =>
    Promise.resolve()
        .then(() => Promise.resolve())
        .then(() => Promise.resolve());

describe('ManagedLockService', () => {
    let module: TestingModule;
    let service: ManagedLockService;
    let mockLock: DistributedLockPort;

    beforeEach(async () => {
        vi.useFakeTimers();

        mockLock = {
            tryAcquire: vi.fn().mockResolvedValue(null),
            release: vi.fn().mockResolvedValue(true),
            extend: vi.fn().mockResolvedValue(true),
            withLock: vi.fn(),
        };

        module = await Test.createTestingModule({
            providers: [ManagedLockService, { provide: DISTRIBUTED_LOCK_PORT, useValue: mockLock }],
        }).compile();

        service = module.get(ManagedLockService);
    });

    afterEach(async () => {
        vi.useRealTimers();
        await module.close();
    });

    describe('hold', () => {
        it('should call tryAcquire immediately on start', async () => {
            service.hold({ lockName: LOCK_NAME, ttlMs: TTL_MS, onAcquired: vi.fn() });

            await flushAsync();

            expect(mockLock.tryAcquire).toHaveBeenCalledWith(LOCK_NAME, TTL_MS);
        });

        it('should call onAcquired when lock is acquired', async () => {
            vi.mocked(mockLock.tryAcquire).mockResolvedValue(HANDLE);
            const onAcquired = vi.fn().mockResolvedValue(undefined);

            service.hold({ lockName: LOCK_NAME, ttlMs: TTL_MS, onAcquired });

            await flushAsync();

            expect(onAcquired).toHaveBeenCalledOnce();
        });

        it('should not call onAcquired when lock is not acquired', async () => {
            vi.mocked(mockLock.tryAcquire).mockResolvedValue(null);
            const onAcquired = vi.fn();

            service.hold({ lockName: LOCK_NAME, ttlMs: TTL_MS, onAcquired });

            await flushAsync();

            expect(onAcquired).not.toHaveBeenCalled();
        });

        it('should retry acquisition after retryIntervalMs when lock is not acquired', async () => {
            vi.mocked(mockLock.tryAcquire).mockResolvedValue(null);
            const retryIntervalMs = 500;

            service.hold({
                lockName: LOCK_NAME,
                ttlMs: TTL_MS,
                retryIntervalMs,
                onAcquired: vi.fn(),
            });
            await flushAsync();
            expect(mockLock.tryAcquire).toHaveBeenCalledTimes(1);

            await vi.advanceTimersByTimeAsync(retryIntervalMs);
            expect(mockLock.tryAcquire).toHaveBeenCalledTimes(2);

            await vi.advanceTimersByTimeAsync(retryIntervalMs);
            expect(mockLock.tryAcquire).toHaveBeenCalledTimes(3);
        });

        it('should start renewing after acquisition using default renewalIntervalMs (ttlMs / 3)', async () => {
            vi.mocked(mockLock.tryAcquire).mockResolvedValue(HANDLE);

            service.hold({ lockName: LOCK_NAME, ttlMs: TTL_MS, onAcquired: vi.fn() });
            await flushAsync();

            const renewalIntervalMs = Math.floor(TTL_MS / 3);
            await vi.advanceTimersByTimeAsync(renewalIntervalMs);

            expect(mockLock.extend).toHaveBeenCalledWith(HANDLE, TTL_MS);
        });

        it('should restart retry when extend returns false', async () => {
            vi.mocked(mockLock.tryAcquire).mockResolvedValue(HANDLE);
            vi.mocked(mockLock.extend).mockResolvedValue(false);
            const retryIntervalMs = 500;

            service.hold({
                lockName: LOCK_NAME,
                ttlMs: TTL_MS,
                retryIntervalMs,
                onAcquired: vi.fn(),
            });
            await flushAsync();

            const renewalIntervalMs = Math.floor(TTL_MS / 3);
            await vi.advanceTimersByTimeAsync(renewalIntervalMs);
            await flushAsync();

            vi.mocked(mockLock.tryAcquire).mockResolvedValue(null);
            await vi.advanceTimersByTimeAsync(retryIntervalMs);
            expect(mockLock.tryAcquire).toHaveBeenCalledTimes(2);
        });

        it('should restart retry when extend throws', async () => {
            vi.mocked(mockLock.tryAcquire).mockResolvedValue(HANDLE);
            vi.mocked(mockLock.extend).mockRejectedValue(new Error('Redis error'));
            const retryIntervalMs = 500;

            service.hold({
                lockName: LOCK_NAME,
                ttlMs: TTL_MS,
                retryIntervalMs,
                onAcquired: vi.fn(),
            });
            await flushAsync();

            const renewalIntervalMs = Math.floor(TTL_MS / 3);
            await vi.advanceTimersByTimeAsync(renewalIntervalMs);
            await flushAsync();

            vi.mocked(mockLock.tryAcquire).mockResolvedValue(null);
            await vi.advanceTimersByTimeAsync(retryIntervalMs);
            expect(mockLock.tryAcquire).toHaveBeenCalledTimes(2);
        });

        it('should release lock and retry when onAcquired throws', async () => {
            vi.mocked(mockLock.tryAcquire).mockResolvedValue(HANDLE);
            const retryIntervalMs = 500;
            const onAcquired = vi.fn().mockRejectedValue(new Error('startup failed'));

            service.hold({ lockName: LOCK_NAME, ttlMs: TTL_MS, retryIntervalMs, onAcquired });
            await flushAsync();

            expect(mockLock.release).toHaveBeenCalledWith(HANDLE);

            vi.mocked(mockLock.tryAcquire).mockResolvedValue(null);
            await vi.advanceTimersByTimeAsync(retryIntervalMs);
            expect(mockLock.tryAcquire).toHaveBeenCalledTimes(2);
        });

        it('should re-acquire and call onAcquired again after lock is lost and re-acquired', async () => {
            vi.mocked(mockLock.tryAcquire).mockResolvedValue(HANDLE);
            vi.mocked(mockLock.extend).mockResolvedValue(false);
            const onAcquired = vi.fn().mockResolvedValue(undefined);
            const retryIntervalMs = 500;

            service.hold({ lockName: LOCK_NAME, ttlMs: TTL_MS, retryIntervalMs, onAcquired });
            await flushAsync();
            expect(onAcquired).toHaveBeenCalledTimes(1);

            const renewalIntervalMs = Math.floor(TTL_MS / 3);
            await vi.advanceTimersByTimeAsync(renewalIntervalMs);
            await flushAsync();

            await vi.advanceTimersByTimeAsync(retryIntervalMs);
            await flushAsync();
            expect(onAcquired).toHaveBeenCalledTimes(2);
        });
    });

    describe('dispose', () => {
        it('should release lock and stop all intervals on dispose', async () => {
            vi.mocked(mockLock.tryAcquire).mockResolvedValue(HANDLE);

            const handle = service.hold({
                lockName: LOCK_NAME,
                ttlMs: TTL_MS,
                onAcquired: vi.fn(),
            });
            await flushAsync();

            await handle.dispose();

            expect(mockLock.release).toHaveBeenCalledWith(HANDLE);

            vi.mocked(mockLock.tryAcquire).mockClear();
            vi.mocked(mockLock.extend).mockClear();
            await vi.advanceTimersByTimeAsync(TTL_MS * 2);
            expect(mockLock.tryAcquire).not.toHaveBeenCalled();
            expect(mockLock.extend).not.toHaveBeenCalled();
        });

        it('should be idempotent', async () => {
            vi.mocked(mockLock.tryAcquire).mockResolvedValue(HANDLE);

            const handle = service.hold({
                lockName: LOCK_NAME,
                ttlMs: TTL_MS,
                onAcquired: vi.fn(),
            });
            await flushAsync();

            await handle.dispose();
            await handle.dispose();

            expect(mockLock.release).toHaveBeenCalledOnce();
        });

        it('should not release lock if it was never acquired', async () => {
            vi.mocked(mockLock.tryAcquire).mockResolvedValue(null);

            const handle = service.hold({
                lockName: LOCK_NAME,
                ttlMs: TTL_MS,
                onAcquired: vi.fn(),
            });
            await flushAsync();

            await handle.dispose();

            expect(mockLock.release).not.toHaveBeenCalled();
        });
    });
});
