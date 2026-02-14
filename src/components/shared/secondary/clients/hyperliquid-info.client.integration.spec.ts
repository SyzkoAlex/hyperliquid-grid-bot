import { beforeAll, describe, expect, it } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { TradingSymbol } from '@domain/primitives/trading-symbol';
import { HyperliquidInfoClient } from '@components/shared/secondary/clients/hyperliquid-info.client';
import { HyperliquidUserStateMapper } from '@components/shared/secondary/mappers/hyperliquid-user-state.mapper';
import { HyperliquidModule } from '@infra/hyperliquid/hyperliquid.module';
import { HyperliquidApiClient } from '@infra/hyperliquid/hyperliquid-api.client';
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

    describe('pairExists', () => {
        it('should return true for HYPE token', async () => {
            const symbol = TradingSymbol.create('HYPE');
            const exists = await client.pairExists(symbol);

            expect(exists).toBe(true);
            console.log('✅ HYPE token exists:', exists);
        });

        it.skip('should return true for BTC token', async () => {
            const symbol = TradingSymbol.create('BTC');
            const exists = await client.pairExists(symbol);

            expect(exists).toBe(true);
            console.log('✅ BTC token exists:', exists);
        });

        it('should return false for invalid token', async () => {
            const symbol = TradingSymbol.create('INVALID_XYZ');
            const exists = await client.pairExists(symbol);

            expect(exists).toBe(false);
            console.log('❌ INVALID_XYZ token exists:', exists);
        });

        it('should list first 10 available tokens', async () => {
            const hyperliquidApiClient =
                testingModule.get<HyperliquidApiClient>(HyperliquidApiClient);
            const spotMeta = await hyperliquidApiClient.getSpotMeta();
            const tokens = spotMeta.data.tokens.slice(0, 10);

            console.log('📋 First 10 tokens from API:');
            tokens.forEach((token: any) => {
                console.log(`  - ${token.name} (tokenId: ${token.tokenId})`);
            });

            expect(tokens.length).toBeGreaterThan(0);
        });

        it('should search for specific tokens in full list', async () => {
            const hyperliquidApiClient =
                testingModule.get<HyperliquidApiClient>(HyperliquidApiClient);
            const spotMeta = await hyperliquidApiClient.getSpotMeta();
            const tokens = spotMeta.data.tokens;

            console.log(`\n📊 Total tokens: ${tokens.length}`);

            const searchTokens = ['HYPE', 'BTC', 'ETH', 'SOL', 'USDC'];
            console.log('\n🔍 Searching for popular tokens:');

            searchTokens.forEach((searchToken) => {
                const found = tokens.find((token: any) => token.name === searchToken);
                if (found) {
                    console.log(`  ✅ ${searchToken}: FOUND (tokenId: ${found.tokenId})`);
                } else {
                    console.log(`  ❌ ${searchToken}: NOT FOUND`);
                }
            });

            expect(tokens.length).toBeGreaterThan(0);
        });
    });
});
