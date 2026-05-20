import { Injectable } from '@nestjs/common';
import { TopSymbolsCacheService } from '@components/trading/core/application/services/top-symbols-cache/top-symbols-cache.service';
import { DEFAULT_TOP_TOKENS } from '@components/trading/core/domain/models/constants/default-top-tokens';
import { TokenDescriptor } from '@components/trading/core/domain/models/token/token-descriptor';

@Injectable()
export class GetTopSymbolsUseCase {
    constructor(private readonly cache: TopSymbolsCacheService) {}

    async execute(limit: number): Promise<TokenDescriptor[]> {
        return this.cache.getOrDefault(limit, DEFAULT_TOP_TOKENS);
    }
}
