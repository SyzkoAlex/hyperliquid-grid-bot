import { Global, Module } from '@nestjs/common';
import { vi } from 'vitest';
import { DISTRIBUTED_LOCK_PORT } from '@/core/application/ports/outbound/distributed-lock.port';

@Global()
@Module({
    providers: [
        {
            provide: DISTRIBUTED_LOCK_PORT,
            useValue: {
                tryAcquire: vi.fn().mockResolvedValue({ lockName: 'test', ownerId: 'test' }),
                release: vi.fn().mockResolvedValue(true),
                extend: vi.fn().mockResolvedValue(true),
                withLock: vi
                    .fn()
                    .mockImplementation((_name: string, _ttl: number, fn: () => Promise<unknown>) =>
                        fn(),
                    ),
            },
        },
    ],
    exports: [DISTRIBUTED_LOCK_PORT],
})
export class MockDistributedLockModule {}
