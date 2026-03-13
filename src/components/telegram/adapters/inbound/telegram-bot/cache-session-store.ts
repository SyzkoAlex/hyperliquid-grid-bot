import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AsyncSessionStore } from 'telegraf/typings/session';
import { CACHE_PORT, CachePort } from '@/core/application/ports/outbound/cache.port';
import { Config } from '@/config/config.schema';
import { logger } from '@/infra/logger/logger';
import { SessionData } from './types/session-data';

@Injectable()
export class CacheSessionStore implements AsyncSessionStore<SessionData> {
    private readonly logger = logger.child({ context: CacheSessionStore.name });
    private readonly ttlSeconds: number;
    private readonly keyPrefix: string;

    constructor(
        @Inject(CACHE_PORT) private readonly cache: CachePort,
        configService: ConfigService<Config, true>,
    ) {
        const sessionConfig = configService.get('telegram', { infer: true }).session;
        this.ttlSeconds = sessionConfig.ttlSeconds;
        this.keyPrefix = sessionConfig.keyPrefix;
    }

    async get(key: string): Promise<SessionData | undefined> {
        const data = await this.cache.get(`${this.keyPrefix}${key}`);

        if (!data) return undefined;

        try {
            return JSON.parse(data) as SessionData;
        } catch {
            this.logger.warn({ key }, 'Corrupted session data, removing');
            await this.delete(key);
            return undefined;
        }
    }

    async set(key: string, value: SessionData): Promise<void> {
        await this.cache.set(`${this.keyPrefix}${key}`, JSON.stringify(value), this.ttlSeconds);
    }

    async delete(key: string): Promise<void> {
        await this.cache.del(`${this.keyPrefix}${key}`);
    }
}
