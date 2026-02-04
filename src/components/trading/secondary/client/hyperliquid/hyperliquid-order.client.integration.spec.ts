import { beforeAll, describe, expect, it } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { Symbol as TradingSymbol } from '../../../core/domain/common/symbol';
import { Price } from '../../../core/domain/common/price';
import { Decimal } from '@domain/primitives/decimal';
import { OrderSide } from '../../../core/domain/order/order-side';
import { OrderStatus } from '../../../core/domain/order/order-status';
import { ExchangePlaceOrderParams } from '../../../core/domain/exchange-order/exchange-place-order-params';
import { OrderId } from '../../../core/domain/order/order-id';
import { HyperliquidOrderClient } from './hyperliquid-order.client';
import { HyperliquidSdkService } from './hyperliquid-sdk.service';
import { HyperliquidOrderMapper } from './hyperliquid-order.mapper';
import { HyperliquidUserStateMapper } from './hyperliquid-user-state.mapper';
import { HttpService } from '../../../../../infra/http/http.service';
import { loadConfiguration } from '../../../../../infra/config/configuration';
import type { Config } from '../../../../../infra/config/config.schema';
import { HyperliquidUserFillResponse } from './types/hyperliquid-user-fill';

// Load test environment variables from .env.test
loadEnv({ path: resolve(process.cwd(), '.env.test') });

/**
 * Integration Tests for HyperliquidOrderClient
 *
 * These tests verify real interaction with Hyperliquid Testnet API.
 *
 * Prerequisites:
 * 1. Configure .env.test with testnet credentials
 * 2. Ensure test wallet has some testnet USDC
 * 3. Run with: pnpm test:integration
 *
 * Test Flow:
 * - Tests that don't need orders run by default (getUserState)
 * - Tests that need orders are skipped by default (placeOrder, cancelOrder)
 *
 * Safety:
 * - Uses Hyperliquid Testnet (not mainnet)
 * - Uses test wallet with minimal funds
 * - Creates orders with very low prices (won't fill)
 * - Cancels all test orders after completion
 */
describe('HyperliquidOrderClient (Integration)', () => {
    let client: HyperliquidOrderClient;
    let sdkService: HyperliquidSdkService;
    let httpService: HttpService;
    let configService: ConfigService<Config, true>;
    let testWalletAddress: string;
    let testingModule: TestingModule;

    beforeAll(async () => {
        await initializeTestClient();
    });

    describe('getUserState', () => {
        it('should retrieve user state from testnet', async () => {
            const userState = await client.getUserSpotState(testWalletAddress);

            // Verify domain object structure
            expect(userState).toBeDefined();
            expect(userState.withdrawableBalance).toBeDefined();
            expect(userState.assetPositions).toBeInstanceOf(Array);

            console.log('💰 Account balance:', userState.withdrawableBalance.toString(), 'USDC');
            console.log(
                '📊 Total positions:',
                userState.assetPositions.map((p) => `${p.symbol}:${p.size}`),
            );
        });
    });

    describe('getCurrentPrice', () => {
        it('should retrieve current market price for HYPE', async () => {
            const symbol = TradingSymbol.create('HYPE');

            const price = await client.getCurrentPrice(symbol);

            // Verify Price domain object
            expect(price).toBeDefined();
            expect(price.toNumber()).toBeGreaterThan(0);

            console.log('💵 Current HYPE price:', price.toNumber());
        });

        it('should retrieve current market price for BTC', async () => {
            const symbol = TradingSymbol.create('BTC');

            const price = await client.getCurrentPrice(symbol);

            // Verify Price domain object
            expect(price).toBeDefined();
            expect(price.toNumber()).toBeGreaterThan(0);

            console.log('💵 Current BTC price:', price.toNumber());
        });

        it('should throw error for invalid symbol', async () => {
            const invalidSymbol = TradingSymbol.create('INVALID_SYMBOL_XYZ');

            await expect(client.getCurrentPrice(invalidSymbol)).rejects.toThrow(
                'Price not available for symbol INVALID_SYMBOL_XYZ',
            );
        });

        it('should retrieve prices for multiple symbols', async () => {
            // Using symbols available on testnet
            const symbols = ['HYPE', 'BTC'].map(TradingSymbol.create);

            const prices = await Promise.all(symbols.map((s) => client.getCurrentPrice(s)));

            // Verify all prices are valid
            prices.forEach((price, idx) => {
                expect(price).toBeDefined();
                expect(price.toNumber()).toBeGreaterThan(0);
                console.log(`💵 ${symbols[idx].toString()} price:`, price.toNumber());
            });

            // BTC should be more expensive than HYPE (generally)
            expect(prices[1].toNumber()).toBeGreaterThan(prices[0].toNumber());
        });
    });

    describe.skip('getOpenOrders', () => {
        it('should retrieve open orders array', async () => {
            const openOrders = await client.getOpenSpotOrders(testWalletAddress);

            // Verify returns array with valid structure
            expect(openOrders).toBeInstanceOf(Array);

            // Check structure of first order if any exist
            if (openOrders.length > 0) {
                const order = openOrders[0];
                expect(order.id).toBeDefined();
                expect(order.symbol).toBeDefined();
                expect(order.side).toBeDefined();
                expect(order.amount).toBeDefined();
            }

            console.log('📝 Open orders count:', openOrders.length);
        });

        it('should retrieve open orders with proper mapping', async () => {
            // Requires funded spot balance on testnet (minimum 10 USDC)
            // To run manually: deposit USDC to spot on testnet
            // Use HYPE-SPOT for testing as it's available on testnet
            // Get mid price first to place order within 80% range
            const midPrices = await sdkService.getSdk().info.getAllMids();
            const hypeMid = parseFloat(midPrices['HYPE-SPOT'] || '25');
            const testPrice = Math.round(hypeMid * 0.8 * 100) / 100; // 20% below mid, 2 decimals
            const testAmount = 1; // ~$25 at current prices

            // First, place a test order (won't fill due to low price)
            const orderParams: ExchangePlaceOrderParams = {
                symbol: TradingSymbol.create('HYPE'),
                side: OrderSide.Buy,
                price: Price.from(testPrice),
                amount: Decimal.from(testAmount),
                orderId: OrderId.create(),
            };

            const placeResult = await client.placeSpotOrder(orderParams);

            // Check if order was successfully placed
            if (placeResult.error || !placeResult.exchangeOrderId) {
                throw new Error(
                    `Failed to place test order: ${placeResult.error || 'No order ID returned'}`,
                );
            }

            expect(placeResult.exchangeOrderId).toBeDefined();
            expect(placeResult.exchangeOrderId).not.toBe('');

            console.log('✅ Test order placed:', placeResult.exchangeOrderId);

            // Now retrieve open orders
            const openOrders = await client.getOpenSpotOrders(testWalletAddress);

            // Verify domain object structure
            expect(openOrders).toBeInstanceOf(Array);
            expect(openOrders.length).toBeGreaterThan(0);

            console.log(
                '📦 All orders:',
                openOrders.map((o) => ({ id: o.id, symbol: o.symbol.toString() })),
            );

            // Find our test order by ID
            const testOrder = openOrders.find((o) => o.id === placeResult.exchangeOrderId);

            console.log('🔍 Looking for order ID:', placeResult.exchangeOrderId);
            console.log('🎯 Found order:', testOrder ? testOrder.id : 'NOT FOUND');

            expect(testOrder).toBeDefined();
            // Note: On testnet, symbol mapping may differ from mainnet (HYPE -> SOKEN)
            expect(testOrder!.symbol).toBeDefined();
            expect(testOrder!.side).toBe(OrderSide.Buy);
            expect(testOrder!.price!.toNumber()).toBeCloseTo(testPrice, 2);
            expect(testOrder!.amount.toNumber()).toBe(testAmount);
            expect(testOrder!.status).toBeDefined();

            console.log('📝 Open orders count:', openOrders.length);
            console.log('📋 Test order verified:', testOrder!.id);

            // Cleanup: Cancel the test order
            await client.cancelSpotOrder({
                symbol: orderParams.symbol,
                exchangeOrderId: placeResult.exchangeOrderId,
            });

            console.log('🗑️ Test order cancelled');
        });
    });

    describe.skip('placeOrder', () => {
        it('should place a limit order on testnet', async () => {
            // Uses HYPE-SPOT which is available on testnet
            // Get mid price first to place order within 80% range
            const midPrices = await sdkService.getSdk().info.getAllMids();
            const hypeMid = parseFloat(midPrices['HYPE-SPOT'] || '25');
            const testPrice = Math.round(hypeMid * 0.8 * 100) / 100; // 20% below mid

            const orderParams: ExchangePlaceOrderParams = {
                symbol: TradingSymbol.create('HYPE'),
                side: OrderSide.Buy,
                price: Price.from(testPrice),
                amount: Decimal.from(1), // 1 HYPE ≈ $25
                orderId: OrderId.create(),
            };

            const result = await client.placeSpotOrder(orderParams);

            // Verify result structure
            expect(result).toBeDefined();
            expect(result.status).toBe(OrderStatus.Placed);
            expect(result.exchangeOrderId).toBeDefined();
            expect(result.exchangeOrderId).not.toBe('');

            console.log('✅ Order placed:', result.exchangeOrderId);

            // Cleanup: Cancel the order
            if (result.exchangeOrderId) {
                await client.cancelSpotOrder({
                    symbol: orderParams.symbol,
                    exchangeOrderId: result.exchangeOrderId,
                });
                console.log('🗑️ Test order cancelled');
            }
        });
    });

    describe.skip('cancelOrder', () => {
        it('should cancel a specific order', async () => {
            // Get mid price for HYPE
            const midPrices = await sdkService.getSdk().info.getAllMids();
            const hypeMid = parseFloat(midPrices['HYPE-SPOT'] || '25');
            const testPrice = Math.round(hypeMid * 0.8 * 100) / 100;

            // First, place an order
            const orderParams: ExchangePlaceOrderParams = {
                symbol: TradingSymbol.create('HYPE'),
                side: OrderSide.Buy,
                price: Price.from(testPrice),
                amount: Decimal.from(1),
                orderId: OrderId.create(),
            };

            const placeResult = await client.placeSpotOrder(orderParams);
            expect(placeResult.status).toBe(OrderStatus.Placed);
            expect(placeResult.exchangeOrderId).toBeDefined();
            expect(placeResult.exchangeOrderId).not.toBe('');

            console.log('✅ Order placed:', placeResult.exchangeOrderId);

            // Then cancel it
            const cancelResult = await client.cancelSpotOrder({
                symbol: orderParams.symbol,
                exchangeOrderId: placeResult.exchangeOrderId,
            });

            expect(cancelResult.success).toBe(true);
            expect(cancelResult.exchangeOrderId).toBe(placeResult.exchangeOrderId);

            console.log('✅ Order cancelled:', cancelResult.exchangeOrderId);
        });
    });

    describe('getOrderStatus', () => {
        it('should retrieve status for historical filled order', async () => {
            // Query userFills to get historical orders from previous test runs
            const apiUrl = configService.get('hyperliquid', { infer: true }).apiUrl;

            const response = await httpService.post<HyperliquidUserFillResponse[]>(
                `${apiUrl}/info`,
                {
                    type: 'userFills',
                    user: testWalletAddress,
                },
            );

            const fills = response.data;

            if (fills.length === 0) {
                console.log('⚠️ No historical fills found, skipping test');
                return;
            }

            // Use most recent fill to test getOrderStatus
            const recentFill = fills[0];
            const orderIdToQuery = recentFill.oid;

            console.log(`📋 Testing with order ID: ${orderIdToQuery} from recent fill`);

            const orderStatus = await client.getOrderStatus(testWalletAddress, orderIdToQuery);

            // Verify order status was retrieved
            expect(orderStatus).not.toBeNull();
            expect(orderStatus!.exchangeOrderId).toBe(orderIdToQuery.toString());
            expect(orderStatus!.status).toBeDefined();
            expect(orderStatus!.statusTimestamp).toBeGreaterThan(0);

            console.log('✅ Historical order status retrieved:', orderStatus!.status);
        });

        it('should return null for unknown order ID', async () => {
            const unknownOrderId = 'unknown_order_id_12345';

            const orderStatus = await client.getOrderStatus(testWalletAddress, unknownOrderId);

            expect(orderStatus).toBeNull();

            console.log('✅ Unknown order correctly returned null');
        });

        it('should return null for unknown numeric order ID', async () => {
            const unknownNumericOid = 999999999999;

            const orderStatus = await client.getOrderStatus(testWalletAddress, unknownNumericOid);

            expect(orderStatus).toBeNull();

            console.log('✅ Unknown numeric order correctly returned null');
        });
    });

    async function initializeTestClient() {
        testingModule = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    isGlobal: true,
                    load: [loadConfiguration],
                }),
            ],
            providers: [
                HttpService,
                HyperliquidSdkService,
                HyperliquidOrderMapper,
                HyperliquidUserStateMapper,
                HyperliquidOrderClient,
            ],
        }).compile();

        await testingModule.init();

        client = testingModule.get<HyperliquidOrderClient>(HyperliquidOrderClient);
        sdkService = testingModule.get<HyperliquidSdkService>(HyperliquidSdkService);
        httpService = testingModule.get<HttpService>(HttpService);
        configService = testingModule.get<ConfigService<Config, true>>(ConfigService);

        testWalletAddress = configService.get('hyperliquid', { infer: true }).accountAddress;

        console.log('🧪 Test setup complete');
        console.log(`📍 Testnet API: ${process.env.HYPERLIQUID_API_URL}`);
        console.log(`👛 Test wallet: ${testWalletAddress}`);
    }
});
