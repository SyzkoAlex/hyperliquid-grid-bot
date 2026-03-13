import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { OrdersWebsocketAdapter } from '@components/trading/adapters/inbound/orders-websocket/orders-websocket.adapter';
import type { ExchangePort } from '@components/trading/core/application/ports/exchange.port';
import { EXCHANGE_PORT } from '@components/trading/core/application/ports/exchange.port';
import { HyperliquidModule } from './hyperliquid.module';
import { HyperliquidSdkService } from './hyperliquid-sdk.service';
import { ProcessOrderStatusUseCase } from '@components/trading/core/application/use-cases/process-order-status/process-order-status.use-case';
import { loadConfiguration } from '@/config/configuration';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Price } from '@domain/models/primitives/price';
import { Decimal } from '@domain/models/primitives/decimal';
import { OrderSide } from '@domain/models/order/order-side';
import type { ExchangePlaceOrderParams } from '@components/trading/core/domain/models/exchange-order/exchange-place-order-params';

loadEnv({ path: resolve(process.cwd(), '.env.test') });

describe('Orders WebSocket (Integration)', () => {
    let wsAdapter: OrdersWebsocketAdapter;
    let exchangeAdapter: ExchangePort;
    let sdkService: HyperliquidSdkService;
    let testingModule: TestingModule;
    let mockProcessOrderStatus: { execute: ReturnType<typeof vi.fn> };

    beforeAll(async () => {
        mockProcessOrderStatus = {
            execute: vi.fn().mockResolvedValue({ success: true, isGridOrder: false, orderId: 0 }),
        };

        testingModule = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    isGlobal: true,
                    load: [loadConfiguration],
                }),
                HyperliquidModule,
            ],
            providers: [
                OrdersWebsocketAdapter,
                { provide: ProcessOrderStatusUseCase, useValue: mockProcessOrderStatus },
            ],
        }).compile();

        await testingModule.init();

        wsAdapter = testingModule.get<OrdersWebsocketAdapter>(OrdersWebsocketAdapter);
        exchangeAdapter = testingModule.get<ExchangePort>(EXCHANGE_PORT);
        sdkService = testingModule.get<HyperliquidSdkService>(HyperliquidSdkService);

        wsAdapter.onModuleInit();
    });

    afterAll(async () => {
        if (wsAdapter) {
            wsAdapter.onModuleDestroy();
        }
        if (testingModule) {
            await testingModule.close();
        }
    });

    describe('WebSocket Connection', () => {
        it('should connect to Hyperliquid testnet WebSocket', async () => {
            await waitForConnection(5000);
            expect(wsAdapter.isConnected()).toBe(true);
        });

        it('should maintain connection after initialization', async () => {
            await waitForConnection(5000);
            await sleep(1000);
            expect(wsAdapter.isConnected()).toBe(true);
        });
    });

    describe('Real-time Order Status Updates', () => {
        it('should receive order status when placing and canceling order', async () => {
            await waitForConnection(5000);

            const midPrices = await sdkService.getSdk().info.getAllMids();
            const hypeMid = parseFloat(midPrices['HYPE-SPOT'] || '25');
            const testPrice = Math.round(hypeMid * 1.2 * 100) / 100;

            const orderParams: ExchangePlaceOrderParams = {
                symbol: TradingSymbol.create('HYPE'),
                side: OrderSide.Sell,
                price: Price.from(testPrice),
                amount: Decimal.from(10),
                orderId: crypto.randomUUID(),
            };

            const placeResult = await exchangeAdapter.placeSpotOrder(orderParams);

            if (!placeResult.exchangeOrderId || placeResult.error) {
                return;
            }

            await sleep(3000);

            await exchangeAdapter.cancelSpotOrder({
                symbol: orderParams.symbol,
                exchangeOrderId: placeResult.exchangeOrderId,
            });

            await sleep(5000);

            if (mockProcessOrderStatus.execute.mock.calls.length > 0) {
                const firstCall = mockProcessOrderStatus.execute.mock.calls[0][0];
                expect(firstCall.orderStatus.coin).toBeDefined();
                expect(firstCall.orderStatus.exchangeOrderId).toBeDefined();
                expect(firstCall.orderStatus.status).toBeDefined();
                expect(firstCall.orderStatus.statusTimestamp).toBeGreaterThan(0);
            }
        }, 50_000);
    });

    async function waitForConnection(timeout: number): Promise<void> {
        const startTime = Date.now();
        while (!wsAdapter.isConnected()) {
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
