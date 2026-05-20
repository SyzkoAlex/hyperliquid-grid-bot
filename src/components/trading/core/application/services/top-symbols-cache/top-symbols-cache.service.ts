import { Inject, Injectable } from '@nestjs/common';
import { logger } from '@/infra/logger/logger';
import { CACHE_PORT, CachePort } from '@/core/application/ports/outbound/cache.port';
import { TokenDescriptor } from '@components/trading/core/domain/models/token/token-descriptor';

@Injectable()
export class TopSymbolsCacheService {
    private static readonly CACHE_KEY = 'trading:top-symbols:v2';
    private readonly logger = logger.child({ context: TopSymbolsCacheService.name });

    constructor(@Inject(CACHE_PORT) private readonly cache: CachePort) {}

    async get(): Promise<TokenDescriptor[] | null> {
        const raw = await this.cache.get(TopSymbolsCacheService.CACHE_KEY);
        if (!raw) return null;
        try {
            const parsed: unknown = JSON.parse(raw);
            if (
                !Array.isArray(parsed) ||
                !parsed.every(
                    (item): item is TokenDescriptor =>
                        typeof item === 'object' &&
                        item !== null &&
                        typeof (item as TokenDescriptor).symbol === 'string' &&
                        typeof (item as TokenDescriptor).displayName === 'string',
                )
            ) {
                this.logger.warn('Corrupted top-symbols cache entry — clearing');
                await this.cache.del(TopSymbolsCacheService.CACHE_KEY);
                return null;
            }
            return parsed;
        } catch {
            this.logger.warn('Failed to parse top-symbols cache — clearing');
            await this.cache.del(TopSymbolsCacheService.CACHE_KEY);
            return null;
        }
    }

    async set(tokens: TokenDescriptor[], ttlSeconds: number): Promise<void> {
        await this.cache.set(TopSymbolsCacheService.CACHE_KEY, JSON.stringify(tokens), ttlSeconds);
    }

    async getOrDefault(
        limit: number,
        defaults: ReadonlyArray<TokenDescriptor>,
    ): Promise<TokenDescriptor[]> {
        const cached = await this.get();
        if (cached && cached.length > 0) {
            return cached.slice(0, limit);
        }
        return [...defaults].slice(0, limit);
    }
}
