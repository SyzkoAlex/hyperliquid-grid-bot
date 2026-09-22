import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Config } from '@/config/config.schema';
import { CACHE_PORT } from '@/core/application/ports/outbound/cache.port';
import { RedisCacheAdapter } from '@/adapters/outbound/cache/redis-cache.adapter';
import { CacheTestHelper } from './cache-test-helper';

/**
 * Connects only once: the factory connects eagerly (so specs work without `module.init()`),
 * and a later `module.init()` reuses that connection instead of leaking a second client.
 */
class ConnectOnceRedisCacheAdapter extends RedisCacheAdapter {
    private connecting?: Promise<void>;

    override onModuleInit(): Promise<void> {
        this.connecting ??= super.onModuleInit();
        return this.connecting;
    }
}

/**
 * Provides CACHE_PORT backed by the Redis testcontainer.
 * Requires `CacheTestHelper.initialize()` before the testing module is compiled.
 * The adapter is connected in the factory, so it works without `module.init()`.
 */
@Global()
@Module({
    providers: [
        {
            provide: CACHE_PORT,
            useFactory: async () => {
                const { host, port } = CacheTestHelper.getConnectionDetails();
                const config = {
                    get: () => ({ url: `redis://${host}:${port}`, db: 0 }),
                } as unknown as ConfigService<Config, true>;
                const adapter = new ConnectOnceRedisCacheAdapter(config);
                await adapter.onModuleInit();
                return adapter;
            },
        },
    ],
    exports: [CACHE_PORT],
})
export class TestCacheModule {}
