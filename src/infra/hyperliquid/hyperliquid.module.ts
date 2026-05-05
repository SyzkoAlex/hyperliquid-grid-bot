import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Config } from '@/config/config.schema';
import { HyperliquidHttpClient } from './http/hyperliquid-http.client';
import { HyperliquidMetaService } from './meta/hyperliquid-meta.service';
import { HyperliquidInfoService } from './info/hyperliquid-info.service';
import { HyperliquidOrdersService } from './orders/hyperliquid-orders.service';

@Module({
    providers: [
        {
            provide: HyperliquidHttpClient,
            useFactory: (config: ConfigService<Config, true>) => {
                const { apiUrl, requestTimeout } = config.get('hyperliquid', { infer: true });
                return new HyperliquidHttpClient(apiUrl, requestTimeout);
            },
            inject: [ConfigService],
        },
        HyperliquidMetaService,
        HyperliquidInfoService,
        {
            provide: HyperliquidOrdersService,
            useFactory: (
                http: HyperliquidHttpClient,
                meta: HyperliquidMetaService,
                config: ConfigService<Config, true>,
            ) => {
                const isMainnet = !config.get('hyperliquid', { infer: true }).testnet;
                return new HyperliquidOrdersService(http, meta, isMainnet);
            },
            inject: [HyperliquidHttpClient, HyperliquidMetaService, ConfigService],
        },
    ],
    exports: [HyperliquidMetaService, HyperliquidInfoService, HyperliquidOrdersService],
})
export class HyperliquidModule {}
