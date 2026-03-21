import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';
import { logger } from '@/infra/logger/logger';
import {
    DistributedLockPort,
    LockHandle,
} from '@/core/application/ports/outbound/distributed-lock.port';
import { Config } from '@/config/config.schema';

const RELEASE_SCRIPT =
    "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

const EXTEND_SCRIPT =
    "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('pexpire', KEYS[1], ARGV[2]) else return 0 end";

@Injectable()
export class RedisDistributedLockAdapter
    implements DistributedLockPort, OnModuleInit, OnModuleDestroy
{
    private client: RedisClientType;
    private readonly instanceId = crypto.randomUUID();
    private readonly logger = logger.child({ context: RedisDistributedLockAdapter.name });

    constructor(private readonly configService: ConfigService<Config, true>) {}

    async onModuleInit() {
        const { url, db } = this.configService.get('redis', { infer: true });

        this.logger.info('Connecting to Redis (distributed lock)...');

        this.client = createClient({ url, database: db });

        this.client.on('error', (err) => {
            this.logger.error({ err }, 'Redis lock connection error');
        });

        this.client.on('connect', () => {
            this.logger.info('Redis lock client connecting');
        });

        this.client.on('ready', () => {
            this.logger.info('Redis lock client ready');
        });

        await this.client.connect();
        this.logger.info('Redis lock connected successfully');
    }

    async onModuleDestroy() {
        this.logger.info('Closing Redis lock connection...');
        await this.client.quit();
        this.logger.info('Redis lock connection closed');
    }

    async tryAcquire(lockName: string, ttlMs: number): Promise<LockHandle | null> {
        const key = `lock:${lockName}`;
        this.logger.trace({ lockName, ttlMs }, 'Attempting to acquire lock');

        const result = await this.client.set(key, this.instanceId, { NX: true, PX: ttlMs });

        if (result === 'OK') {
            this.logger.trace({ lockName }, 'Lock acquired');
            return { lockName, ownerId: this.instanceId };
        }

        this.logger.debug({ lockName }, 'Lock not acquired: held by another instance');
        return null;
    }

    async release(handle: LockHandle): Promise<boolean> {
        const key = `lock:${handle.lockName}`;
        const deleted = await this.client.eval(RELEASE_SCRIPT, {
            keys: [key],
            arguments: [handle.ownerId],
        });
        const released = deleted === 1;
        this.logger.trace({ lockName: handle.lockName, released }, 'Lock release attempt');
        return released;
    }

    async extend(handle: LockHandle, ttlMs: number): Promise<boolean> {
        const key = `lock:${handle.lockName}`;
        const result = await this.client.eval(EXTEND_SCRIPT, {
            keys: [key],
            arguments: [handle.ownerId, String(ttlMs)],
        });
        const extended = result === 1;
        this.logger.trace({ lockName: handle.lockName, extended }, 'Lock extend attempt');
        return extended;
    }

    async withLock<T>(lockName: string, ttlMs: number, fn: () => Promise<T>): Promise<T | null> {
        const handle = await this.tryAcquire(lockName, ttlMs);
        if (!handle) return null;

        try {
            return await fn();
        } finally {
            await this.release(handle);
        }
    }
}
