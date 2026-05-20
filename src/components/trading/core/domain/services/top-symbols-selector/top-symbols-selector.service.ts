import { Injectable } from '@nestjs/common';
import { SpotMeta } from '@/infra/hyperliquid/types/hyperliquid-spot-meta';
import { HyperliquidSpotAssetCtx } from '@/infra/hyperliquid/types/hyperliquid-spot-asset-ctx';
import { TokenDescriptor } from '@components/trading/core/domain/models/token/token-descriptor';
import { TokenDisplayResolverService } from '@components/trading/core/domain/services/token-display-resolver/token-display-resolver.service';

export const EXCLUDED_STABLECOIN_BASES = new Set(['USDT', 'USDH']);

type SpotMetaToken = SpotMeta['tokens'][number];

@Injectable()
export class TopSymbolsSelectorService {
    constructor(private readonly tokenDisplay: TokenDisplayResolverService) {}

    select(meta: SpotMeta, assetCtxs: HyperliquidSpotAssetCtx[], limit: number): TokenDescriptor[] {
        const usdcIndex = meta.tokens.find((t) => t.name === 'USDC')?.index;
        if (usdcIndex === undefined) {
            return [];
        }

        const candidates = meta.universe
            .map((u, i) => ({ u, ctx: assetCtxs[i] }))
            .filter(({ u, ctx }) => u.tokens[1] === usdcIndex && ctx !== undefined)
            .map(({ u, ctx }) => {
                const base = meta.tokens.find((t) => t.index === u.tokens[0]);
                return base ? { base, volume: parseFloat(ctx.dayNtlVlm) } : null;
            })
            .filter(
                (x): x is { base: SpotMetaToken; volume: number } =>
                    x !== null &&
                    isFinite(x.volume) &&
                    x.volume > 0 &&
                    !EXCLUDED_STABLECOIN_BASES.has(x.base.name),
            )
            .sort((a, b) => b.volume - a.volume)
            .slice(0, limit);

        return candidates.map(({ base }) => ({
            symbol: base.name,
            displayName: this.tokenDisplay.resolve(base),
        }));
    }
}
