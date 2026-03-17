import { Module, Global } from '@nestjs/common';
import { DISTRIBUTED_LOCK_PORT } from '@/core/application/ports/outbound/distributed-lock.port';
import { RedisDistributedLockAdapter } from './redis-distributed-lock.adapter';

@Global()
@Module({
    providers: [{ provide: DISTRIBUTED_LOCK_PORT, useClass: RedisDistributedLockAdapter }],
    exports: [DISTRIBUTED_LOCK_PORT],
})
export class RedisDistributedLockModule {}
