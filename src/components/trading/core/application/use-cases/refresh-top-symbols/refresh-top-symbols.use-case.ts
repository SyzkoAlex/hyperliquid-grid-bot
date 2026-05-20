import { Inject, Injectable } from '@nestjs/common';
import {
    EXCHANGE_PORT,
    ExchangePort,
} from '@components/trading/core/application/ports/exchange.port';
import { TopSymbolsCacheService } from '@components/trading/core/application/services/top-symbols-cache/top-symbols-cache.service';

@Injectable()
export class RefreshTopSymbolsUseCase {
    constructor(
        @Inject(EXCHANGE_PORT) private readonly exchange: ExchangePort,
        private readonly cache: TopSymbolsCacheService,
    ) {}

    // Exceptions from the exchange propagate to the caller (TopSymbolsRefreshAdapter),
    // which logs and swallows them so a transient failure never crashes the polling loop.
    async execute(limit: number, cacheTtlSeconds: number): Promise<void> {
        const tokens = await this.exchange.getTopSymbolsByVolume(limit);
        if (tokens.length > 0) {
            await this.cache.set(tokens, cacheTtlSeconds);
        }
    }
}
