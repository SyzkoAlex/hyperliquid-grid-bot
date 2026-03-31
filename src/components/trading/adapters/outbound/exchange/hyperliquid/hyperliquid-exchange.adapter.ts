import { Inject, Injectable } from '@nestjs/common';
import { logger } from '@/infra/logger/logger';
import { METRICS_PORT, MetricsPort } from '@/core/application/ports/outbound/metrics.port';
import { startTimer } from '@/infra/metrics/timer';
import { ExchangePort } from '@components/trading/core/application/ports/exchange.port';
import { ExchangePlaceOrderParams } from '@components/trading/core/domain/models/exchange-order/exchange-place-order-params';
import { ExchangePlaceOrderResult } from '@components/trading/core/domain/models/exchange-order/exchange-place-order-result';
import { ExchangeCancelOrderParams } from '@components/trading/core/domain/models/exchange-order/exchange-cancel-order-params';
import { ExchangeCancelOrderResult } from '@components/trading/core/domain/models/exchange-order/exchange-cancel-order-result';
import { ExchangeOpenOrder } from '@components/trading/core/domain/models/exchange-order/exchange-open-order';
import { ExchangeOrderInfo } from '@components/trading/core/domain/models/exchange-order/exchange-order-info';
import { UserState } from '@components/trading/core/domain/models/user-state/user-state';
import { Price } from '@domain/models/primitives/price';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { HyperliquidSdkService } from './hyperliquid-sdk.service';
import { HyperliquidExchangeMapper } from './hyperliquid-exchange.mapper';
import { HyperliquidSymbol } from './types/hyperliquid-symbol';
import { HyperliquidOpenOrder } from './types/hyperliquid-open-order';
import { HyperliquidOrderStatusResponse } from './types/hyperliquid-order-status-response';
import { HyperliquidUserStateResponse } from './types/hyperliquid-user-state-response';

@Injectable()
export class HyperliquidExchangeAdapter implements ExchangePort {
    private readonly logger = logger.child({ context: HyperliquidExchangeAdapter.name });

    constructor(
        private readonly sdkService: HyperliquidSdkService,
        private readonly mapper: HyperliquidExchangeMapper,
        @Inject(METRICS_PORT) private readonly metrics: MetricsPort,
    ) {}

    async placeSpotOrder(params: ExchangePlaceOrderParams): Promise<ExchangePlaceOrderResult> {
        const stop = startTimer();
        try {
            const szDecimals = this.sdkService.getSzDecimals(params.symbol.toString());
            const orderRequest = this.mapper.toSdkPlaceOrderRequest(params, szDecimals);
            const sdk = this.sdkService.getSdk();

            this.logger.debug(orderRequest, 'Placing order via SDK');
            const response = await sdk.exchange.placeOrder(orderRequest);
            this.logger.info({ orderRequest, response }, 'Order placed');

            return this.mapper.toExchangePlaceOrderResult(response);
        } catch (error) {
            this.logger.error({ err: error, params }, 'Failed to place order');
            throw error;
        } finally {
            this.metrics.observeExchangeApiDuration('placeSpotOrder', stop());
        }
    }

    async cancelSpotOrder(params: ExchangeCancelOrderParams): Promise<ExchangeCancelOrderResult> {
        const stop = startTimer();
        try {
            const sdk = this.sdkService.getSdk();
            const cancelRequest = {
                coin: HyperliquidSymbol.toSpotFormat(params.symbol.toString()),
                o: Number(params.exchangeOrderId),
            };

            this.logger.debug(cancelRequest, 'Cancelling order via SDK');
            const response = await sdk.exchange.cancelOrder(cancelRequest);
            this.logger.info({ params, response }, 'Order cancelled');

            return {
                exchangeOrderId: params.exchangeOrderId,
                success: response?.status === 'ok',
            };
        } catch (error) {
            this.logger.error({ err: error, params }, 'Failed to cancel order');
            return {
                exchangeOrderId: params.exchangeOrderId,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        } finally {
            this.metrics.observeExchangeApiDuration('cancelSpotOrder', stop());
        }
    }

    async getCurrentPrice(symbol: TradingSymbol): Promise<Price> {
        const stop = startTimer();
        try {
            const sdk = this.sdkService.getSdk();
            const spotKey = this.sdkService.lookupSpotKey(symbol.toString());
            const mids = (await sdk.info.getAllMids(true)) as Record<string, string>;
            const priceStr = mids[spotKey];

            if (!priceStr) {
                throw new Error(`Price not available for ${symbol.toString()}`);
            }

            return Price.from(parseFloat(priceStr));
        } finally {
            this.metrics.observeExchangeApiDuration('getCurrentPrice', stop());
        }
    }

    async getOpenSpotOrders(user: string): Promise<ExchangeOpenOrder[]> {
        const stop = startTimer();
        try {
            const sdk = this.sdkService.getSdk();
            const orders = (await sdk.info.getUserOpenOrders(
                user,
                true,
            )) as unknown as HyperliquidOpenOrder[];
            const resolveSymbol = (coin: string) => this.sdkService.resolveSpotSymbol(coin);
            return this.mapper.toOpenOrders(orders, resolveSymbol);
        } catch (error) {
            this.logger.error({ err: error, user }, 'Failed to get open orders');
            throw error;
        } finally {
            this.metrics.observeExchangeApiDuration('getOpenSpotOrders', stop());
        }
    }

    async getOrderStatus(user: string, oid: number | string): Promise<ExchangeOrderInfo | null> {
        const stop = startTimer();
        try {
            const sdk = this.sdkService.getSdk();
            const resolvedOid =
                typeof oid === 'string' && !oid.startsWith('0x') ? Number(oid) : oid;
            const response = (await sdk.info.getOrderStatus(
                user,
                resolvedOid,
                true,
            )) as unknown as HyperliquidOrderStatusResponse;

            if (!response) {
                return null;
            }

            if (response.status === 'unknownOid') {
                return null;
            }

            return this.mapper.toExchangeOrderInfo(response);
        } catch (error) {
            if (isApiError(error, 422)) {
                this.logger.debug({ user, oid }, 'Order status 422, treating as not found');
                return null;
            }
            this.logger.error({ err: error, user, oid }, 'Failed to get order status');
            throw error;
        } finally {
            this.metrics.observeExchangeApiDuration('getOrderStatus', stop());
        }
    }

    async getUserSpotState(user: string): Promise<UserState> {
        const stop = startTimer();
        try {
            const sdk = this.sdkService.getSdk();
            const response = (await sdk.info.spot.getSpotClearinghouseState(
                user,
                true,
            )) as unknown as HyperliquidUserStateResponse;
            return this.mapper.toUserState(response);
        } catch (error) {
            this.logger.error({ error, user }, 'Failed to get user state');
            throw error;
        } finally {
            this.metrics.observeExchangeApiDuration('getUserSpotState', stop());
        }
    }

    async pairExists(symbol: TradingSymbol): Promise<boolean> {
        const stop = startTimer();
        try {
            return await this.sdkService.pairExists(symbol.toString());
        } finally {
            this.metrics.observeExchangeApiDuration('pairExists', stop());
        }
    }
}

function isApiError(error: unknown, code: number): boolean {
    return (
        error instanceof Error &&
        error.name === 'HyperliquidAPIError' &&
        Number((error as Error & { code: unknown }).code) === code
    );
}
