import { Inject, Injectable } from '@nestjs/common';
import { logger } from '@/infra/logger/logger';
import { CACHE_PORT, CachePort } from '@/core/application/ports/outbound/cache.port';
import { StopLossBreachState } from '../types/stop-loss-breach-state';

@Injectable()
export class StopLossBreachStateCacheService {
    private readonly logger = logger.child({ context: StopLossBreachStateCacheService.name });

    constructor(@Inject(CACHE_PORT) private readonly cache: CachePort) {}

    async get(gridId: string): Promise<StopLossBreachState | null> {
        const raw = await this.cache.get(this.key(gridId));
        if (!raw) return null;

        try {
            const parsed: unknown = JSON.parse(raw);
            if (
                typeof parsed !== 'object' ||
                parsed === null ||
                typeof (parsed as Record<string, unknown>).firstBreachAt !== 'number'
            ) {
                this.logger.warn({ gridId }, 'Corrupted breach state in cache — clearing');
                await this.cache.del(this.key(gridId));
                return null;
            }
            return new StopLossBreachState((parsed as { firstBreachAt: number }).firstBreachAt);
        } catch {
            this.logger.warn({ gridId }, 'Failed to parse breach state from cache — clearing');
            await this.cache.del(this.key(gridId));
            return null;
        }
    }

    async set(gridId: string, state: StopLossBreachState, ttlSeconds: number): Promise<void> {
        await this.cache.set(
            this.key(gridId),
            JSON.stringify({ firstBreachAt: state.firstBreachAt }),
            ttlSeconds,
        );
    }

    async delete(gridId: string): Promise<void> {
        await this.cache.del(this.key(gridId));
    }

    private key(gridId: string): string {
        return `sl:breach:${gridId}`;
    }
}
