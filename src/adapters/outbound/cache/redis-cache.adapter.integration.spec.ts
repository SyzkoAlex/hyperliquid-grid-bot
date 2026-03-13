import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CacheTestHelper } from '@/infra/tests/cache-test-helper';
import { RedisCacheAdapter } from './redis-cache.adapter';
import { CACHE_PORT, CachePort } from '@/core/application/ports/outbound/cache.port';

describe('RedisCacheAdapter (Integration)', () => {
    let module: TestingModule;
    let cache: CachePort;

    beforeAll(async () => {
        await CacheTestHelper.initialize();
        const { host, port } = CacheTestHelper.getConnectionDetails();

        module = await Test.createTestingModule({
            providers: [
                {
                    provide: CACHE_PORT,
                    useClass: RedisCacheAdapter,
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
        cache = module.get<CachePort>(CACHE_PORT);
    });

    afterEach(async () => {
        await CacheTestHelper.cleanup();
    });

    afterAll(async () => {
        await module.close();
        await CacheTestHelper.close();
    });

    it('should return null for non-existent key', async () => {
        const result = await cache.get('non-existent');
        expect(result).toBeNull();
    });

    it('should set and get a value', async () => {
        await cache.set('key1', 'value1');

        const result = await cache.get('key1');
        expect(result).toBe('value1');
    });

    it('should overwrite existing value', async () => {
        await cache.set('key1', 'original');
        await cache.set('key1', 'updated');

        const result = await cache.get('key1');
        expect(result).toBe('updated');
    });

    it('should delete a key', async () => {
        await cache.set('key1', 'value1');
        await cache.del('key1');

        const result = await cache.get('key1');
        expect(result).toBeNull();
    });

    it('should not throw when deleting non-existent key', async () => {
        await expect(cache.del('non-existent')).resolves.not.toThrow();
    });

    it('should set value with TTL and expire it', async () => {
        await cache.set('ttl-key', 'ttl-value', 1);

        const before = await cache.get('ttl-key');
        expect(before).toBe('ttl-value');

        await new Promise((resolve) => setTimeout(resolve, 1100));

        const after = await cache.get('ttl-key');
        expect(after).toBeNull();
    });

    it('should handle storing JSON strings', async () => {
        const json = JSON.stringify({ foo: 'bar', num: 42 });
        await cache.set('json-key', json);

        const result = await cache.get('json-key');
        expect(JSON.parse(result!)).toEqual({ foo: 'bar', num: 42 });
    });

    it('should store multiple independent keys', async () => {
        await cache.set('a', '1');
        await cache.set('b', '2');
        await cache.set('c', '3');

        expect(await cache.get('a')).toBe('1');
        expect(await cache.get('b')).toBe('2');
        expect(await cache.get('c')).toBe('3');
    });
});
