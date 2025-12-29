import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '../../../../../infra/http/http.service';
import { logger } from '../../../../../infra/logger/logger';
import { Symbol as TradingSymbol } from '../../../core/domain/common/symbol';
import { Price } from '../../../core/domain/common/price';
import { UserState } from '../../../core/domain/user-state/user-state';
import { ExchangePlaceOrderParams } from '../../../core/domain/exchange-order/exchange-place-order-params';
import { ExchangePlaceOrderResult } from '../../../core/domain/exchange-order/exchange-place-order-result';
import { ExchangeCancelOrderParams } from '../../../core/domain/exchange-order/exchange-cancel-order-params';
import { ExchangeCancelOrderResult } from '../../../core/domain/exchange-order/exchange-cancel-order-result';
import { ExchangeOpenOrder } from '../../../core/domain/exchange-order/exchange-open-order';
import { HyperliquidOrderMapper } from './hyperliquid-order.mapper';
import { HyperliquidSpotUserStateResponse } from './types/hyperliquid-user-state-response';
import { HyperliquidUserStateMapper } from './hyperliquid-user-state.mapper';
import { HyperliquidSdkService } from './hyperliquid-sdk.service';
import { HyperliquidOpenOrder } from './types/hyperliquid-open-order';
import { HyperliquidOrderStatusResponse } from './types/hyperliquid-order-status-response';
import { Config } from '../../../../../infra/config/config.schema';
import { ExchangeOrderInfo } from '../../../core/domain/exchange-order/exchange-order-info';

@Injectable()
export class HyperliquidOrderClient {
    private readonly apiUrl: string;
    private readonly logger = logger.child({ context: HyperliquidOrderClient.name });

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService<Config, true>,
        private readonly sdkService: HyperliquidSdkService,
        private readonly orderMapper: HyperliquidOrderMapper,
        private readonly userStateMapper: HyperliquidUserStateMapper,
    ) {
        this.apiUrl = this.configService.get('hyperliquid', { infer: true }).apiUrl;
    }

    async placeSpotOrder(params: ExchangePlaceOrderParams): Promise<ExchangePlaceOrderResult> {
        try {
            const sdk = this.sdkService.getSdk();
            const orderRequest = this.orderMapper.toSdkPlaceOrderRequest(params);

            this.logger.debug(orderRequest, 'Placing order via SDK');

            const response = await sdk.exchange.placeOrder(orderRequest);

            this.logger.info({ params, response }, 'Order placed');

            return this.orderMapper.toExchangePlaceOrderResultFromSdk(response);
        } catch (error) {
            this.logger.error({ error, params }, 'Failed to place order');
            throw error;
        }
    }

    async cancelSpotOrder(params: ExchangeCancelOrderParams): Promise<ExchangeCancelOrderResult> {
        try {
            const sdk = this.sdkService.getSdk();
            const cancelRequest = this.orderMapper.toSdkCancelOrderRequest(
                params.symbol,
                params.exchangeOrderId,
            );

            this.logger.debug(cancelRequest, 'Cancelling order via SDK');

            const response = await sdk.exchange.cancelOrder(cancelRequest);

            this.logger.info({ params, response }, 'Order cancelled');

            return {
                exchangeOrderId: params.exchangeOrderId,
                success: response?.status === 'ok',
            };
        } catch (error) {
            this.logger.error({ error, params }, 'Failed to cancel order');
            return {
                exchangeOrderId: params.exchangeOrderId,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    async getOpenSpotOrders(user: string): Promise<ExchangeOpenOrder[]> {
        try {
            const response = await this.httpService.post<HyperliquidOpenOrder[]>(
                `${this.apiUrl}/info`,
                {
                    type: 'openOrders',
                    user,
                },
            );

            return this.orderMapper.toOpenOrders(response.data);
        } catch (error) {
            this.logger.error({ error, user }, 'Failed to get open orders');
            throw error;
        }
    }

    async getUserSpotState(user: string): Promise<UserState> {
        try {
            const response = await this.httpService.post<HyperliquidSpotUserStateResponse>(
                `${this.apiUrl}/info`,
                {
                    type: 'spotClearinghouseState',
                    user,
                },
            );

            this.logger.debug({ user }, 'User state retrieved');

            return this.userStateMapper.toUserState(response.data);
        } catch (error) {
            this.logger.error({ error, user }, 'Failed to get user state');
            throw error;
        }
    }

    /**
     * Get current market price for a symbol
     *
     * Fetches the mid price (average of best bid and ask) from Hyperliquid.
     * This is the real-time market price used for grid order placement.
     *
     * @param symbol - Trading symbol (e.g., 'BTC', 'ETH', 'HYPE')
     * @returns Current mid price
     * @throws Error if price not available or symbol not found
     */
    async getCurrentPrice(symbol: TradingSymbol): Promise<Price> {
        try {
            const allMids = await this.sdkService.getSdk().info.getAllMids();
            const spotSymbol = `${symbol.toString()}-SPOT`;
            const midPriceStr = allMids[spotSymbol];

            if (!midPriceStr) {
                throw new Error(`Price not available for symbol ${symbol.toString()}`);
            }

            const price = Price.from(parseFloat(midPriceStr));

            this.logger.debug(
                { symbol: symbol.toString(), price: price.toNumber() },
                'Current price retrieved',
            );

            return price;
        } catch (error) {
            this.logger.error({ error, symbol: symbol.toString() }, 'Failed to get current price');
            throw error;
        }
    }

    /**
     * Query order status by OID or CLOID
     *
     * https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint#query-order-status-by-oid-or-cloid
     *
     * @param user - User wallet address
     * @param oid - Either numeric order ID or hex string client order ID (cloid)
     * @returns Order status or null if not found
     */
    async getOrderStatus(user: string, oid: number | string): Promise<ExchangeOrderInfo | null> {
        try {
            const response = await this.httpService.post<HyperliquidOrderStatusResponse>(
                `${this.apiUrl}/info`,
                {
                    type: 'orderStatus',
                    user,
                    oid,
                },
            );

            if (!response.data) {
                this.logger.debug({ user, oid }, 'Empty response');
                return null;
            }

            if (response.data.status === 'unknownOid') {
                this.logger.debug({ user, oid }, 'Order not found');
                return null;
            }

            // At this point, TypeScript knows response.data.status === 'order'
            this.logger.debug({ user, oid, response: response.data }, 'Order status retrieved');

            return this.orderMapper.toExchangeOrderInfo(response.data);
        } catch (error) {
            // Handle 422 response - order not found
            // Axios wraps HTTP errors in error.response.status
            if (error && typeof error === 'object' && 'response' in error) {
                const axiosError = error as { response?: { status?: number } };
                if (axiosError.response?.status === 422) {
                    this.logger.debug({ user, oid }, 'Order not found (422 response)');
                    return null;
                }
            }
            this.logger.error({ error, user, oid }, 'Failed to get order status');
            throw error;
        }
    }
}
