import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CacheTestHelper } from '@/infra/tests/cache-test-helper';
import { RedisDistributedLockAdapter } from './redis-distributed-lock.adapter';
import {
    DISTRIBUTED_LOCK_PORT,
    DistributedLockPort,
} from '@/core/application/ports/outbound/distributed-lock.port';

describe('RedisDistributedLockAdapter (Integration)', () => {
    let module: TestingModule;
    let lock: DistributedLockPort;

    beforeAll(async () => {
        await CacheTestHelper.initialize();
        const { host, port } = CacheTestHelper.getConnectionDetails();

        module = await Test.createTestingModule({
            providers: [
                {
                    provide: DISTRIBUTED_LOCK_PORT,
                    useClass: RedisDistributedLockAdapter,
                },
                {
                    provide: ConfigService,
                    useValue: {
                        get: (key: string) => {
                            if (key === 'redis') {
                                return { url: `redis://${host}:${port}`, db: 0 };
                            }
                        },
                    },
                },
            ],
        }).compile();

        await module.init();
        lock = module.get<DistributedLockPort>(DISTRIBUTED_LOCK_PORT);
    });

    afterEach(async () => {
        await CacheTestHelper.cleanup();
    });

    afterAll(async () => {
        await module.close();
        await CacheTestHelper.close();
    });

    it('should return a LockHandle when lock is free', async () => {
        const handle = await lock.tryAcquire('test-lock', 5000);
        expect(handle).not.toBeNull();
        expect(handle!.lockName).toBe('test-lock');
        expect(handle!.ownerId).toBeTruthy();
    });

    it('should return null when lock is already held', async () => {
        const first = await lock.tryAcquire('test-lock', 5000);
        expect(first).not.toBeNull();

        const second = await lock.tryAcquire('test-lock', 5000);
        expect(second).toBeNull();
    });

    it('should allow re-acquisition after release', async () => {
        const handle = await lock.tryAcquire('test-lock', 5000);
        expect(handle).not.toBeNull();

        await lock.release(handle!);

        const reAcquired = await lock.tryAcquire('test-lock', 5000);
        expect(reAcquired).not.toBeNull();
    });

    it('should not release lock with wrong owner', async () => {
        const handle = await lock.tryAcquire('test-lock', 5000);
        expect(handle).not.toBeNull();

        const wrongHandle = { lockName: 'test-lock', ownerId: 'wrong-owner-id' };
        const released = await lock.release(wrongHandle);
        expect(released).toBe(false);

        // original lock should still be held
        const attempt = await lock.tryAcquire('test-lock', 5000);
        expect(attempt).toBeNull();
    });

    it('should execute function and release lock via withLock', async () => {
        let executed = false;

        const result = await lock.withLock('test-lock', 5000, async () => {
            executed = true;
            return 'done';
        });

        expect(result).toBe('done');
        expect(executed).toBe(true);

        // lock should be released - can re-acquire
        const handle = await lock.tryAcquire('test-lock', 5000);
        expect(handle).not.toBeNull();
    });

    it('should return null from withLock when lock is held', async () => {
        const handle = await lock.tryAcquire('test-lock', 5000);
        expect(handle).not.toBeNull();

        let executed = false;
        const result = await lock.withLock('test-lock', 5000, async () => {
            executed = true;
            return 'done';
        });

        expect(result).toBeNull();
        expect(executed).toBe(false);
    });

    it('should release lock even if function throws', async () => {
        await expect(
            lock.withLock('test-lock', 5000, async () => {
                throw new Error('Something failed');
            }),
        ).rejects.toThrow('Something failed');

        // lock should be released
        const handle = await lock.tryAcquire('test-lock', 5000);
        expect(handle).not.toBeNull();
    });

    it('should extend lock TTL when owner calls extend', async () => {
        const handle = await lock.tryAcquire('test-lock', 5000);
        expect(handle).not.toBeNull();

        const extended = await lock.extend(handle!, 5000);
        expect(extended).toBe(true);

        // lock should still be held
        const attempt = await lock.tryAcquire('test-lock', 5000);
        expect(attempt).toBeNull();
    });

    it('should not extend lock with wrong owner', async () => {
        const handle = await lock.tryAcquire('test-lock', 5000);
        expect(handle).not.toBeNull();

        const wrongHandle = { lockName: 'test-lock', ownerId: 'wrong-owner-id' };
        const extended = await lock.extend(wrongHandle, 5000);
        expect(extended).toBe(false);
    });

    it('should auto-expire lock after TTL', async () => {
        const handle = await lock.tryAcquire('test-lock', 200);
        expect(handle).not.toBeNull();

        await new Promise((resolve) => setTimeout(resolve, 300));

        const reAcquired = await lock.tryAcquire('test-lock', 5000);
        expect(reAcquired).not.toBeNull();
    });
});
