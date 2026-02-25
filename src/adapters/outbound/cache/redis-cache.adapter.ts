import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';
import { logger } from '@/infra/logger/logger';
import { CachePort } from '@/core/application/ports/outbound/cache.port';
import { Config } from '@/config/config.schema';

@Injectable()
export class RedisCacheAdapter implements CachePort, OnModuleInit, OnModuleDestroy {
    private client: RedisClientType;
    private readonly logger = logger.child({ context: RedisCacheAdapter.name });

    constructor(private readonly configService: ConfigService<Config, true>) {}

    async onModuleInit() {
        const { url, db } = this.configService.get('redis', { infer: true });

        this.logger.info('Connecting to Redis...');

        this.client = createClient({
            url,
            database: db,
        });

        this.client.on('error', (err) => {
            this.logger.error({ err }, 'Redis connection error');
        });

        this.client.on('connect', () => {
            this.logger.info('Redis client connecting');
        });

        this.client.on('ready', () => {
            this.logger.info('Redis client ready');
        });

        await this.client.connect();
        this.logger.info('Redis connected successfully');
    }

    async onModuleDestroy() {
        this.logger.info('Closing Redis connection...');
        await this.client.quit();
        this.logger.info('Redis connection closed');
    }

    async get(key: string): Promise<string | null> {
        return this.client.get(key);
    }

    async set(key: string, value: string, ttl?: number): Promise<void> {
        if (ttl) {
            await this.client.setEx(key, ttl, value);
        } else {
            await this.client.set(key, value);
        }
    }

    async del(key: string): Promise<void> {
        await this.client.del(key);
    }
}
