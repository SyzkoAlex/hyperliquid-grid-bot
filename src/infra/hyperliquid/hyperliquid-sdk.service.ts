import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Hyperliquid } from 'hyperliquid';
import { logger } from '../logger/logger';
import { HyperliquidSymbol } from './types/hyperliquid-symbol';
import { Config } from '../config/config.schema';

/**
 * Hyperliquid SDK Service
 * Wrapper around the official Hyperliquid SDK for NestJS DI
 */
@Injectable()
export class HyperliquidSdkService implements OnModuleInit {
    private readonly logger = logger.child({ context: HyperliquidSdkService.name });
    private sdk!: Hyperliquid;
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
            enableWs: false,
            disableAssetMapRefresh: true,
        });

        await this.sdk.connect();

        await this.loadSpotAssetMap();

        this.logger.info({ testnet: isTestnet }, 'Hyperliquid SDK initialized and connected');
    }

    private async loadSpotAssetMap(): Promise<void> {
        try {
            const spotMeta = await this.sdk.info.spot.getSpotMeta();

            for (const token of spotMeta.tokens) {
                const key = `@${token.tokenId}`;
                this.spotAssetMap.set(key, token.name);
            }

            this.logger.info({ count: this.spotAssetMap.size }, 'Spot asset map loaded');
        } catch (error) {
            this.logger.error({ error }, 'Failed to load spot asset map');
        }
    }

    getSdk(): Hyperliquid {
        if (!this.sdk) {
            throw new Error('Hyperliquid SDK not initialized. Set privateKey in config.');
        }
        return this.sdk;
    }

    resolveSpotSymbol(coin: string): string {
        let resolved = coin;

        if (coin.startsWith('@')) {
            const symbol = this.spotAssetMap.get(coin);
            if (symbol) {
                resolved = symbol;
            } else {
                this.logger.warn({ coin }, 'Unknown spot asset ID');
            }
        }

        if (HyperliquidSymbol.hasSpotSuffix(resolved)) {
            resolved = HyperliquidSymbol.stripSpotSuffix(resolved);
        }

        return resolved;
    }
}
