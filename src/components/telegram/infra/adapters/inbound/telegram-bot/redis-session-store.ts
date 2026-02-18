import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AsyncSessionStore } from 'telegraf/typings/session';
import { RedisService } from '@infra/cache/redis.service';
import { Config } from '@infra/config/config.schema';
import { logger } from '@infra/logger/logger';
import { SessionData } from './types/session-data';

const KEY_PREFIX = 'tg:session:';

@Injectable()
export class RedisSessionStore implements AsyncSessionStore<SessionData> {
    private readonly logger = logger.child({ context: RedisSessionStore.name });
    private readonly ttlSeconds: number;

    constructor(
        private readonly redis: RedisService,
        configService: ConfigService<Config, true>,
    ) {
        this.ttlSeconds = configService.get('telegram', { infer: true }).session.ttlSeconds;
    }

    async get(key: string): Promise<SessionData | undefined> {
        const data = await this.redis.get(`${KEY_PREFIX}${key}`);

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
        await this.redis.set(`${KEY_PREFIX}${key}`, JSON.stringify(value), this.ttlSeconds);
    }

    async delete(key: string): Promise<void> {
        await this.redis.del(`${KEY_PREFIX}${key}`);
    }
}
