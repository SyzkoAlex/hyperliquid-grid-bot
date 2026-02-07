import { Injectable } from '@nestjs/common';
import { AsyncSessionStore } from 'telegraf/typings/session';
import { RedisService } from '@infra/cache/redis.service';
import { logger } from '@infra/logger/logger';
import { SessionData } from './types/session-data';

const KEY_PREFIX = 'tg:session:';
const TTL_SECONDS = 86400;

@Injectable()
export class RedisSessionStore implements AsyncSessionStore<SessionData> {
    private readonly logger = logger.child({ context: RedisSessionStore.name });

    constructor(private readonly redis: RedisService) {}

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
        await this.redis.set(`${KEY_PREFIX}${key}`, JSON.stringify(value), TTL_SECONDS);
    }

    async delete(key: string): Promise<void> {
        await this.redis.del(`${KEY_PREFIX}${key}`);
    }
}
