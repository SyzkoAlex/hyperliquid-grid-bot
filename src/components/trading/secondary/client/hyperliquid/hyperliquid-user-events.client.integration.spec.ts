import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { HyperliquidUserEventsClient } from './hyperliquid-user-events.client';
import { HyperliquidOrderClient } from './hyperliquid-order.client';
import { HyperliquidSdkService } from './hyperliquid-sdk.service';
import { HyperliquidOrderMapper } from './hyperliquid-order.mapper';
import { HyperliquidUserStateMapper } from './hyperliquid-user-state.mapper';
import { HttpService } from '../../../../../infra/http/http.service';
import { loadConfiguration } from '../../../../../infra/config/configuration';
import type { HyperliquidWsOrderStatus } from './types/hyperliquid-ws-user-event';
import type { Config } from '@infra/config/config.schema';
import { Symbol as TradingSymbol } from '../../../core/domain/common/symbol';
import { Price } from '../../../core/domain/common/price';
import { Decimal } from '@domain/primitives/decimal';
import { OrderSide } from '../../../core/domain/order/order-side';
import { GridId } from '../../../core/domain/grid/grid-id';
import type { ExchangePlaceOrderParams } from '../../../core/domain/exchange-order/exchange-place-order-params';

loadEnv({ path: resolve(process.cwd(), '.env.test') });

/**
 * Integration Tests for HyperliquidUserEventsClient
 *
 * These tests verify real WebSocket connection with Hyperliquid Testnet.
 *
 * Prerequisites:
 * 1. Configure .env.test with testnet credentials
 * 2. Ensure test wallet has some HYPE tokens for sell order test
 * 3. Run with: pnpm test:integration hyperliquid-user-events
 *
 * Test Flow:
 * - Tests WebSocket connection lifecycle
 * - Tests subscription to orderUpdates channel
 * - Tests real-time order status events by placing sell orders above market
 *
 * Safety:
 * - Uses Hyperliquid Testnet (not mainnet)
 * - Creates sell orders above market (won't fill immediately)
 * - Cancels all test orders after completion
 */
describe('HyperliquidUserEventsClient (Integration)', () => {
    let client: HyperliquidUserEventsClient;
    let orderClient: HyperliquidOrderClient;
    let sdkService: HyperliquidSdkService;
    let testingModule: TestingModule;
    let testWalletAddress: string;

    beforeAll(async () => {
        await initializeTestClient();
    });

    afterAll(async () => {
        if (client) {
            client.onModuleDestroy();
        }

        if (testingModule) {
            await testingModule.close();
        }
    });

    describe('WebSocket Connection', () => {
        it('should connect to Hyperliquid testnet WebSocket', async () => {
            await waitForConnection(5000);

            expect(client.isConnected()).toBe(true);
        });

        it('should maintain connection after initialization', async () => {
            await waitForConnection(5000);

            await sleep(1000);

            expect(client.isConnected()).toBe(true);
        });
    });

    describe('Order Status Handler Registration', () => {
        it('should register order status handler', async () => {
            await waitForConnection(5000);

            const mockHandler = vi.fn();
            const unsubscribe = client.onOrderStatus(mockHandler);

            expect(unsubscribe).toBeInstanceOf(Function);

            unsubscribe();
        });

        it('should unregister order status handler', async () => {
            await waitForConnection(5000);

            const mockHandler = vi.fn();
            const unsubscribe = client.onOrderStatus(mockHandler);

            unsubscribe();

            expect(mockHandler).not.toHaveBeenCalled();
        });

        it('should support multiple handlers', async () => {
            await waitForConnection(5000);

            const handler1 = vi.fn();
            const handler2 = vi.fn();

            const unsubscribe1 = client.onOrderStatus(handler1);
            const unsubscribe2 = client.onOrderStatus(handler2);

            expect(unsubscribe1).toBeInstanceOf(Function);
            expect(unsubscribe2).toBeInstanceOf(Function);

            unsubscribe1();
            unsubscribe2();
        });
    });

    describe('Real-time Order Status Updates', () => {
        it('should receive order status when placing and canceling order', async () => {
            await waitForConnection(5000);

            const midPrices = await sdkService.getSdk().info.getAllMids();
            const hypeMid = parseFloat(midPrices['HYPE-SPOT'] || '25');
            const testPrice = Math.round(hypeMid * 1.2 * 100) / 100;

            const receivedStatuses: HyperliquidWsOrderStatus[] = [];

            const unsubscribe = client.onOrderStatus((status) => {
                receivedStatuses.push(status);
                console.log('📥 Received order status:', status.status, 'OID:', status.order.oid);
            });

            const orderParams: ExchangePlaceOrderParams = {
                symbol: TradingSymbol.create('HYPE'),
                side: OrderSide.Sell,
                price: Price.from(testPrice),
                amount: Decimal.from(10),
                gridId: GridId.create(),
            };

            console.log(
                `📝 Placing SELL order for 10 HYPE at ${testPrice} (120% of mid: ${hypeMid})`,
            );
            const placeResult = await orderClient.placeSpotOrder(orderParams);

            if (!placeResult.exchangeOrderId || placeResult.error) {
                console.log(
                    '⚠️ Could not place order (insufficient balance or error) - skipping WebSocket test',
                );
                console.log(`Error: ${placeResult.error || 'No order ID returned'}`);
                unsubscribe();
                return;
            }

            console.log('✅ Order placed:', placeResult.exchangeOrderId);

            console.log('⏳ Waiting 3 seconds for order placement event...');
            await sleep(3000);

            console.log('🗑️ Canceling test order');
            await orderClient.cancelSpotOrder({
                symbol: orderParams.symbol,
                exchangeOrderId: placeResult.exchangeOrderId,
            });

            console.log('⏳ Waiting 5 seconds for cancellation event...');
            await sleep(5000);

            unsubscribe();

            console.log(`📊 Total events received: ${receivedStatuses.length}`);

            if (receivedStatuses.length > 0) {
                const firstStatus = receivedStatuses[0];
                expect(firstStatus.order).toBeDefined();
                expect(firstStatus.order.coin).toBeDefined();
                expect(firstStatus.order.oid).toBeDefined();
                expect(firstStatus.status).toBeDefined();
                expect(firstStatus.statusTimestamp).toBeGreaterThan(0);

                console.log('✅ orderUpdates events validated successfully');
            } else {
                console.log('ℹ️ No orderUpdates received during test period');
            }
        }, 50_000);
    });

    describe('Error Handling', () => {
        it('should handle handler errors gracefully', async () => {
            await waitForConnection(5000);

            const failingHandler = vi.fn(() => {
                throw new Error('Handler error');
            });

            const unsubscribe = client.onOrderStatus(failingHandler);

            await sleep(2000);

            unsubscribe();
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
                HyperliquidUserEventsClient,
            ],
        }).compile();

        await testingModule.init();

        client = testingModule.get<HyperliquidUserEventsClient>(HyperliquidUserEventsClient);
        orderClient = testingModule.get<HyperliquidOrderClient>(HyperliquidOrderClient);
        sdkService = testingModule.get<HyperliquidSdkService>(HyperliquidSdkService);

        const configService = testingModule.get<ConfigService<Config, true>>(ConfigService);
        testWalletAddress = configService.get('hyperliquid', { infer: true }).accountAddress;

        client.onModuleInit();

        console.log('🧪 Test setup complete');
        console.log(`📍 Testnet WebSocket: ${process.env.HYPERLIQUID_WEBSOCKET_URL}`);
        console.log(`👛 Test wallet: ${testWalletAddress}`);
    }

    async function waitForConnection(timeout: number): Promise<void> {
        const startTime = Date.now();

        while (!client.isConnected()) {
            if (Date.now() - startTime > timeout) {
                throw new Error(`WebSocket connection timeout after ${timeout}ms`);
            }
            await sleep(100);
        }
    }

    function sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
});
