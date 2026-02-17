import { Injectable } from '@nestjs/common';
import { logger } from '@infra/logger/logger';
import { extractErrorDetails } from '@infra/logger/error-logger.helper';
import { HyperliquidApiClient } from '@infra/hyperliquid/hyperliquid-api.client';
import { HyperliquidSdkClient } from '@infra/hyperliquid/hyperliquid-sdk.client';
import { ExchangePlaceOrderParams } from '@components/trading/core/domain/exchange-order/exchange-place-order-params';
import { ExchangePlaceOrderResult } from '@components/trading/core/domain/exchange-order/exchange-place-order-result';
import { ExchangeCancelOrderParams } from '@components/trading/core/domain/exchange-order/exchange-cancel-order-params';
import { ExchangeCancelOrderResult } from '@components/trading/core/domain/exchange-order/exchange-cancel-order-result';
import { ExchangeOpenOrder } from '@components/trading/core/domain/exchange-order/exchange-open-order';
import { ExchangeOrderInfo } from '@components/trading/core/domain/exchange-order/exchange-order-info';
import { HyperliquidOrderMapper } from './hyperliquid-order.mapper';

@Injectable()
export class HyperliquidOrderClient {
    private readonly logger = logger.child({ context: HyperliquidOrderClient.name });

    constructor(
        private readonly apiReadClient: HyperliquidApiClient,
        private readonly sdkClient: HyperliquidSdkClient,
        private readonly orderMapper: HyperliquidOrderMapper,
    ) {}

    async placeSpotOrder(params: ExchangePlaceOrderParams): Promise<ExchangePlaceOrderResult> {
        try {
            const orderRequest = this.orderMapper.toSdkPlaceOrderRequest(params);
            const response = await this.sdkClient.placeSpotOrder(orderRequest);
            return this.orderMapper.toExchangePlaceOrderResultFromSdk(response);
        } catch (error) {
            this.logger.error({ ...extractErrorDetails(error), params }, 'Failed to place order');
            throw error;
        }
    }

    async cancelSpotOrder(params: ExchangeCancelOrderParams): Promise<ExchangeCancelOrderResult> {
        try {
            const response = await this.sdkClient.cancelSpotOrder(
                params.symbol.toString(),
                params.exchangeOrderId,
            );

            return {
                exchangeOrderId: params.exchangeOrderId,
                success: response?.status === 'ok',
            };
        } catch (error) {
            this.logger.error({ ...extractErrorDetails(error), params }, 'Failed to cancel order');
            return {
                exchangeOrderId: params.exchangeOrderId,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    async getSpotPrice(symbol: string): Promise<number> {
        return this.apiReadClient.getSpotPrice(symbol);
    }

    async getOpenSpotOrders(user: string): Promise<ExchangeOpenOrder[]> {
        try {
            const response = await this.apiReadClient.getOpenSpotOrders(user);
            return this.orderMapper.toOpenOrders(response.data);
        } catch (error) {
            this.logger.error({ ...extractErrorDetails(error), user }, 'Failed to get open orders');
            throw error;
        }
    }

    async getOrderStatus(user: string, oid: number | string): Promise<ExchangeOrderInfo | null> {
        try {
            const response = await this.apiReadClient.getOrderStatus(user, oid);

            if (!response.data) {
                this.logger.debug({ user, oid }, 'Empty response');
                return null;
            }

            if (response.data.status === 'unknownOid') {
                this.logger.debug({ user, oid }, 'Order not found');
                return null;
            }

            this.logger.debug({ user, oid, response: response.data }, 'Order status retrieved');
            return this.orderMapper.toExchangeOrderInfo(response.data);
        } catch (error) {
            this.logger.error(
                { ...extractErrorDetails(error), user, oid },
                'Failed to get order status',
            );
            throw error;
        }
    }
}
