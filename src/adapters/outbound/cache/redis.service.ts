import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';
import { logger } from '@/infra/logger/logger';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
    private client: RedisClientType;
    private readonly logger = logger.child({ context: RedisService.name });

    constructor(private readonly configService: ConfigService) {}

    async onModuleInit() {
        const redisUrl = this.configService.get<string>('REDIS_URL');

        if (!redisUrl) {
            throw new Error('REDIS_URL is not defined');
        }

        this.logger.info('Connecting to Redis...');

        this.client = createClient({
            url: redisUrl,
            database: this.configService.get<number>('REDIS_DB', 0),
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

    getClient(): RedisClientType {
        return this.client;
    }

    // Convenience methods
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

    async exists(key: string): Promise<boolean> {
        const result = await this.client.exists(key);
        return result === 1;
    }

    async ttl(key: string): Promise<number> {
        return this.client.ttl(key);
    }

    async expire(key: string, seconds: number): Promise<void> {
        await this.client.expire(key, seconds);
    }

    async keys(pattern: string): Promise<string[]> {
        return this.client.keys(pattern);
    }

    async hSet(key: string, field: string, value: string): Promise<void> {
        await this.client.hSet(key, field, value);
    }

    async hGet(key: string, field: string): Promise<string | undefined> {
        return this.client.hGet(key, field);
    }

    async hGetAll(key: string): Promise<Record<string, string>> {
        return this.client.hGetAll(key);
    }

    async hDel(key: string, field: string): Promise<void> {
        await this.client.hDel(key, field);
    }
}
