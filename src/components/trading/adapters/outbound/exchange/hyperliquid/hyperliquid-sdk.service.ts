import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Hyperliquid, SpotMeta } from 'hyperliquid';
import { logger } from '@/infra/logger/logger';
import { HyperliquidSymbol } from './types/hyperliquid-symbol';
import { Config } from '@/config/config.schema';

/**
 * Manages Hyperliquid SDK lifecycle and spot metadata cache.
 * Single source of truth for SDK instance and token resolution.
 */
@Injectable()
export class HyperliquidSdkService implements OnModuleInit {
    private readonly logger = logger.child({ context: HyperliquidSdkService.name });
    private sdk!: Hyperliquid;
    private spotMeta: SpotMeta | null = null;
    private spotAssetMap = new Map<string, string>();

    constructor(private readonly configService: ConfigService<Config, true>) {}

    async onModuleInit(): Promise<void> {
        const hyperliquidConfig = this.configService.get('hyperliquid', { infer: true });
        const privateKey = hyperliquidConfig.privateKey;
        const apiUrl = hyperliquidConfig.apiUrl;
        const isTestnet = apiUrl.includes('testnet');

        if (!privateKey) {
            this.logger.warn('privateKey not set, SDK will not be initialized');
            return;
        }

        this.sdk = new Hyperliquid({
            privateKey,
            testnet: isTestnet,
            enableWs: false,
            disableAssetMapRefresh: true,
        });

        await this.sdk.connect();
        await this.loadSpotMeta();

        this.logger.info({ testnet: isTestnet }, 'Hyperliquid SDK initialized');
    }

    getSdk(): Hyperliquid {
        if (!this.sdk) {
            throw new Error('Hyperliquid SDK not initialized. Set privateKey in config.');
        }
        return this.sdk;
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

    /**
     * Finds the spot market key (e.g. "@150") for a token symbol.
     * Used to look up mid prices from getAllMids().
     */
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
        const spotMeta = await this.getSdk().info.spot.getSpotMeta(true);
        return spotMeta.tokens.some((token) => token.name === symbol);
    }

    private async loadSpotMeta(): Promise<void> {
        try {
            this.spotMeta = await this.sdk.info.spot.getSpotMeta(true);

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
