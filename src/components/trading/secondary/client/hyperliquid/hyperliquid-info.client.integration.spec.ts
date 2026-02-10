import { beforeAll, describe, expect, it } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { TradingSymbol } from '@domain/primitives/trading-symbol';
import { HyperliquidInfoClient } from '@components/shared/secondary/clients/hyperliquid-info.client';
import { HyperliquidUserStateMapper } from '@components/shared/secondary/mappers/hyperliquid-user-state.mapper';
import { HyperliquidModule } from '@infra/hyperliquid/hyperliquid.module';
import { loadConfiguration } from '@infra/config/configuration';
import type { Config } from '@infra/config/config.schema';

loadEnv({ path: resolve(process.cwd(), '.env.test') });

describe('HyperliquidInfoClient (Integration)', () => {
    let client: HyperliquidInfoClient;
    let testWalletAddress: string;
    let testingModule: TestingModule;

    beforeAll(async () => {
        testingModule = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    isGlobal: true,
                    load: [loadConfiguration],
                }),
                HyperliquidModule,
            ],
            providers: [HyperliquidUserStateMapper, HyperliquidInfoClient],
        }).compile();

        await testingModule.init();

        client = testingModule.get<HyperliquidInfoClient>(HyperliquidInfoClient);
        const configService = testingModule.get<ConfigService<Config, true>>(ConfigService);
        testWalletAddress = configService.get('hyperliquid', { infer: true }).accountAddress;

        console.log('🧪 Test setup complete');
        console.log(`👛 Test wallet: ${testWalletAddress}`);
    });

    describe('getUserSpotState', () => {
        it('should retrieve user spot state from testnet', async () => {
            const userState = await client.getUserSpotState(testWalletAddress);

            expect(userState).toBeDefined();
            expect(userState.withdrawableBalance).toBeDefined();
            expect(userState.assetPositions).toBeInstanceOf(Array);

            console.log('💰 USDC balance:', userState.withdrawableBalance.toString());
            console.log('📊 Positions:', userState.assetPositions.length);
            userState.assetPositions.forEach((position) => {
                console.log(
                    `  - ${position.symbol.toString()}: size=${position.size.toString()}, total=${position.total.toString()}, hold=${position.hold.toString()}`,
                );
            });
        });
    });

    describe('getCurrentPrice', () => {
        it('should retrieve current price for HYPE', async () => {
            // Skip: HYPE-SPOT may not be available on testnet API
            const symbol = TradingSymbol.create('HYPE');
            const price = await client.getCurrentPrice(symbol);

            expect(price).toBeDefined();
            expect(price.toNumber()).toBeGreaterThan(0);

            console.log('💵 HYPE price:', price.toNumber());
        });

        it('should throw error for invalid symbol', async () => {
            const invalidSymbol = TradingSymbol.create('INVALID_XYZ');

            await expect(client.getCurrentPrice(invalidSymbol)).rejects.toThrow(
                'Token not found for symbol: INVALID_XYZ',
            );
        });
    });
});
