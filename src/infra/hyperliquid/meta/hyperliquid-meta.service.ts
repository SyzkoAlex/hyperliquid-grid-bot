import { Injectable, OnModuleInit } from '@nestjs/common';
import { logger } from '@/infra/logger/logger';
import { HyperliquidHttpClient } from '../http/hyperliquid-http.client';
import { SpotMeta } from '../types/spot-meta';
import { HyperliquidSymbol } from '../symbol/hyperliquid-symbol';

/**
 * Manages spot metadata cache (token list, asset map).
 * Replaces the metadata portion of the removed HyperliquidSdkService.
 */
@Injectable()
export class HyperliquidMetaService implements OnModuleInit {
    private readonly logger = logger.child({ context: HyperliquidMetaService.name });
    private spotMeta: SpotMeta | null = null;
    private readonly spotAssetMap = new Map<string, string>();

    constructor(private readonly http: HyperliquidHttpClient) {}

    async onModuleInit(): Promise<void> {
        await this.loadSpotMeta();
    }

    getSzDecimals(symbol: string): number {
        if (!this.spotMeta) {
            throw new Error('Spot meta not loaded');
        }
        const token = this.spotMeta.tokens.find((t) => t.name === symbol);
        if (!token) {
            throw new Error(`Token not found in spot meta: ${symbol}`);
        }
        return token.szDecimals;
    }

    lookupSpotKey(symbol: string): string {
        if (!this.spotMeta) {
            throw new Error('Spot meta not loaded');
        }
        const token = this.spotMeta.tokens.find((t) => t.name === symbol);
        if (!token) {
            throw new Error(`Token not found for symbol: ${symbol}`);
        }
        const universeEntry = this.spotMeta.universe.find((u) => u.tokens[0] === token.index);
        if (!universeEntry) {
            throw new Error(`No spot market found for ${symbol}`);
        }
        return `@${universeEntry.index}`;
    }

    resolveSpotSymbol(coin: string): string {
        let resolved = coin;
        if (coin.startsWith('@')) {
            const symbol = this.spotAssetMap.get(coin);
            if (symbol) {
                resolved = symbol;
            } else {
                this.logger.warn(
                    { coin, mapSize: this.spotAssetMap.size },
                    'Unknown spot asset ID',
                );
            }
        }
        if (HyperliquidSymbol.hasSpotSuffix(resolved)) {
            resolved = HyperliquidSymbol.stripSpotSuffix(resolved);
        }
        return resolved;
    }

    async pairExists(symbol: string): Promise<boolean> {
        const spotMeta = await this.http.postInfo<SpotMeta>({ type: 'spotMeta' });
        return spotMeta.tokens.some((token) => token.name === symbol);
    }

    /**
     * Resolves a plain symbol (e.g. "HYPE") to its numeric spot asset index
     * used in Hyperliquid wire payloads (the `a` field). Hides the `@N` key
     * encoding used internally by the /info endpoint.
     */
    getSpotAssetIndex(symbol: string): number {
        return parseInt(this.lookupSpotKey(symbol).slice(1), 10);
    }

    private async loadSpotMeta(): Promise<void> {
        try {
            this.spotMeta = await this.http.postInfo<SpotMeta>({ type: 'spotMeta' });
            for (const token of this.spotMeta.tokens) {
                const key = `@${token.index}`;
                this.spotAssetMap.set(key, token.name);
            }
            this.logger.info({ tokensCount: this.spotMeta.tokens.length }, 'Spot meta loaded');
        } catch (error) {
            this.logger.error({ error }, 'Failed to load spot meta');
            throw error;
        }
    }
}
