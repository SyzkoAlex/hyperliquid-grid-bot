import { Module, Global } from '@nestjs/common';
import { CACHE_PORT } from '@/core/application/ports/outbound/cache.port';
import { RedisCacheAdapter } from './redis-cache.adapter';

@Global()
@Module({
    providers: [{ provide: CACHE_PORT, useClass: RedisCacheAdapter }],
    exports: [CACHE_PORT],
})
export class RedisCacheModule {}
