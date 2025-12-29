import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Hyperliquid } from 'hyperliquid';
import { logger } from '../../../../../infra/logger/logger';
import { HyperliquidSymbol } from './types/hyperliquid-symbol';
import { Config } from '../../../../../infra/config/config.schema';

/**
 * Hyperliquid SDK Service
 * Wrapper around the official Hyperliquid SDK for NestJS DI
 */
@Injectable()
export class HyperliquidSdkService implements OnModuleInit {
    private readonly logger = logger.child({ context: HyperliquidSdkService.name });
    private sdk!: Hyperliquid;
    // Map of spot asset IDs (@index) to symbol names
    private spotAssetMap = new Map<string, string>();

    constructor(private readonly configService: ConfigService<Config, true>) {}

    async onModuleInit() {
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
            enableWs: false, // We don't need WebSocket for order placement
            disableAssetMapRefresh: true, // We manage our own symbols
        });

        // Connect once during initialization
        await this.sdk.connect();

        // Load spot asset mapping
        await this.loadSpotAssetMap();

        this.logger.info({ testnet: isTestnet }, 'Hyperliquid SDK initialized and connected');
    }

    /**
     * Load spot asset mapping from API
     * Maps @{index} format to symbol names (e.g., @1035 -> HYPE)
     */
    private async loadSpotAssetMap(): Promise<void> {
        try {
            const spotMeta = await this.sdk.info.spot.getSpotMeta();

            for (const token of spotMeta.tokens) {
                // token.index is the spot asset index, token.name is the symbol
                const key = `@${token.index}`;
                this.spotAssetMap.set(key, token.name);
            }

            this.logger.info({ count: this.spotAssetMap.size }, 'Spot asset map loaded');
        } catch (error) {
            this.logger.error({ error }, 'Failed to load spot asset map');
        }
    }

    /**
     * Get the underlying SDK instance
     * @throws Error if SDK is not initialized
     */
    getSdk(): Hyperliquid {
        if (!this.sdk) {
            throw new Error('Hyperliquid SDK not initialized. Set privateKey in config.');
        }
        return this.sdk;
    }

    /**
     * Resolve spot asset ID to symbol name
     * @param coin - Coin identifier (e.g., @1035 or HYPE-SPOT)
     * @returns Symbol name (e.g., HYPE)
     */
    resolveSpotSymbol(coin: string): string {
        let resolved = coin;

        // If it's an @index format, look it up in the map
        if (coin.startsWith('@')) {
            const symbol = this.spotAssetMap.get(coin);
            if (symbol) {
                resolved = symbol;
            } else {
                this.logger.warn({ coin }, 'Unknown spot asset ID');
            }
        }

        // Strip -SPOT suffix if present using HyperliquidSymbol utility
        if (HyperliquidSymbol.hasSpotSuffix(resolved)) {
            resolved = HyperliquidSymbol.stripSpotSuffix(resolved);
        }

        return resolved;
    }
}
