import { beforeAll, describe, expect, it } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Price } from '@domain/models/primitives/price';
import { Decimal } from '@domain/models/primitives/decimal';
import { OrderSide } from '@domain/models/order/order-side';
import { OrderStatus } from '@domain/models/order/order-status';
import {
    ExchangePlaceOrderParams
} from '@components/trading/core/domain/models/exchange-order/exchange-place-order-params';
import type { ExchangePort } from '@components/trading/core/application/ports/exchange.port';
import { EXCHANGE_PORT } from '@components/trading/core/application/ports/exchange.port';
import { METRICS_PORT } from '@/core/application/ports/outbound/metrics.port';
import { HyperliquidModule } from '@/infra/hyperliquid/hyperliquid.module';
import { HyperliquidExchangeMapper } from './hyperliquid-exchange.mapper';
import { HyperliquidExchangeAdapter } from './hyperliquid-exchange.adapter';
import { loadConfiguration } from '@/config/configuration';

loadEnv({ path: resolve(process.cwd(), '.env.test') });

describe('HyperliquidExchangeAdapter (Integration)', () => {
    let adapter: ExchangePort;
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
            providers: [
                HyperliquidExchangeMapper,
                { provide: EXCHANGE_PORT, useClass: HyperliquidExchangeAdapter },
                {
                    provide: METRICS_PORT,
                    useValue: { observeExchangeApiDuration: () => {} },
                },
            ],
        }).compile();

        await testingModule.init();

        adapter = testingModule.get<ExchangePort>(EXCHANGE_PORT);

        testWalletAddress = process.env.HYPERLIQUID_ACCOUNT_ADDRESS ?? '';
    });

    describe('getUserSpotState', () => {
        it('should retrieve user state from testnet', async () => {
            const userState = await adapter.getUserSpotState(testWalletAddress);

            expect(userState).toBeDefined();
            expect(userState.withdrawableBalance).toBeDefined();
            expect(userState.assetPositions).toBeInstanceOf(Array);
        });
    });

    describe('getCurrentPrice', () => {
        it('should retrieve current market price for HYPE', async () => {
            const symbol = TradingSymbol.create('HYPE');

            const price = await adapter.getCurrentPrice(symbol);

            expect(price).toBeDefined();
            expect(price.toNumber()).toBeGreaterThan(0);
        });

        it('should throw error for invalid symbol', async () => {
            const invalidSymbol = TradingSymbol.create('INVALID_SYMBOL_XYZ');

            await expect(adapter.getCurrentPrice(invalidSymbol)).rejects.toThrow(
                'Token not found for symbol: INVALID_SYMBOL_XYZ',
            );
        });
    });

    describe.skip('getOpenOrders', () => {
        it('should retrieve open orders array', async () => {
            const openOrders = await adapter.getOpenSpotOrders(testWalletAddress);

            expect(openOrders).toBeInstanceOf(Array);
        });

        it('should retrieve open orders with proper mapping', async () => {
            const mids = await adapter.getCurrentPrice(TradingSymbol.create('HYPE'));
            const hypeMid = mids.toNumber();
            const testPrice = Math.round(hypeMid * 0.8 * 100) / 100;
            const testAmount = 1;

            const orderParams: ExchangePlaceOrderParams = {
                symbol: TradingSymbol.create('HYPE'),
                side: OrderSide.Buy,
                price: Price.from(testPrice),
                amount: Decimal.from(testAmount),
                orderId: crypto.randomUUID(),
                accountAddress: testWalletAddress,
            };

            const placeResult = await adapter.placeSpotOrder(orderParams);

            if (placeResult.error || !placeResult.exchangeOrderId) {
                throw new Error(
                    `Failed to place test order: ${placeResult.error || 'No order ID returned'}`,
                );
            }

            const openOrders = await adapter.getOpenSpotOrders(testWalletAddress);

            expect(openOrders).toBeInstanceOf(Array);
            expect(openOrders.length).toBeGreaterThan(0);

            const testOrder = openOrders.find((o) => o.id === placeResult.exchangeOrderId);
            expect(testOrder).toBeDefined();
            expect(testOrder!.side).toBe(OrderSide.Buy);
            expect(testOrder!.price!.toNumber()).toBeCloseTo(testPrice, 2);
            expect(testOrder!.amount.toNumber()).toBe(testAmount);

            await adapter.cancelSpotOrder({
                symbol: orderParams.symbol,
                exchangeOrderId: placeResult.exchangeOrderId,
                accountAddress: testWalletAddress,
            });
        });
    });

    describe.skip('placeOrder', () => {
        it('should place a limit order on testnet', async () => {
            const currentPrice = await adapter.getCurrentPrice(TradingSymbol.create('HYPE'));
            const testPrice = Math.round(currentPrice.toNumber() * 0.8 * 100) / 100;

            const orderParams: ExchangePlaceOrderParams = {
                symbol: TradingSymbol.create('HYPE'),
                side: OrderSide.Buy,
                price: Price.from(testPrice),
                amount: Decimal.from(1),
                orderId: crypto.randomUUID(),
                accountAddress: testWalletAddress,
            };

            const result = await adapter.placeSpotOrder(orderParams);

            expect(result).toBeDefined();
            expect(result.status).toBe(OrderStatus.Placed);
            expect(result.exchangeOrderId).toBeDefined();
            expect(result.exchangeOrderId).not.toBe('');

            if (result.exchangeOrderId) {
                await adapter.cancelSpotOrder({
                    symbol: orderParams.symbol,
                    exchangeOrderId: result.exchangeOrderId,
                    accountAddress: testWalletAddress,
                });
            }
        });
    });

    describe.skip('cancelOrder', () => {
        it('should cancel a specific order', async () => {
            const currentPrice = await adapter.getCurrentPrice(TradingSymbol.create('HYPE'));
            const testPrice = Math.round(currentPrice.toNumber() * 0.8 * 100) / 100;

            const orderParams: ExchangePlaceOrderParams = {
                symbol: TradingSymbol.create('HYPE'),
                side: OrderSide.Buy,
                price: Price.from(testPrice),
                amount: Decimal.from(1),
                orderId: crypto.randomUUID(),
                accountAddress: testWalletAddress,
            };

            const placeResult = await adapter.placeSpotOrder(orderParams);
            expect(placeResult.status).toBe(OrderStatus.Placed);

            const cancelResult = await adapter.cancelSpotOrder({
                symbol: orderParams.symbol,
                exchangeOrderId: placeResult.exchangeOrderId,
                accountAddress: testWalletAddress,
            });

            expect(cancelResult.success).toBe(true);
            expect(cancelResult.exchangeOrderId).toBe(placeResult.exchangeOrderId);
        });
    });

    describe('getOrderStatus', () => {
        it('should return null for unknown order ID', async () => {
            const unknownOrderId = 'unknown_order_id_12345';

            const orderStatus = await adapter.getOrderStatus(testWalletAddress, unknownOrderId);

            expect(orderStatus).toBeNull();
        });

        it('should return null for unknown numeric order ID', async () => {
            const unknownNumericOid = 999999999999;

            const orderStatus = await adapter.getOrderStatus(testWalletAddress, unknownNumericOid);

            expect(orderStatus).toBeNull();
        });
    });
});
