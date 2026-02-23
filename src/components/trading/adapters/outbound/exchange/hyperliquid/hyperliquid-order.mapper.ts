import { Injectable } from '@nestjs/common';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Price } from '@domain/models/primitives/price';
import { Decimal } from '@domain/models/primitives/decimal';
import { ExchangePlaceOrderParams } from '@components/trading/core/domain/models/exchange-order/exchange-place-order-params';
import { ExchangePlaceOrderResult } from '@components/trading/core/domain/models/exchange-order/exchange-place-order-result';
import { ExchangeOpenOrder } from '@components/trading/core/domain/models/exchange-order/exchange-open-order';
import { OrderSide } from '@domain/models/order/order-side';
import { OrderType } from '@domain/models/order/order-type';
import { OrderStatus } from '@domain/models/order/order-status';
import { ExchangeOrderInfo } from '@components/trading/core/domain/models/exchange-order/exchange-order-info';
import { ExchangeOrderStatus } from '@components/trading/core/domain/models/exchange-order/exchange-order-status';
import { ExchangeCloid } from '@components/trading/core/domain/models/exchange-order/exchange-cloid';
import { HyperliquidSdkService } from '@/infra/hyperliqued/hyperliquid-sdk.service';
import { HyperliquidApiClient } from '@/infra/hyperliqued/hyperliquid-api.client';
import { HyperliquidPlaceOrderRequest } from '@/infra/hyperliqued/types/hyperliquid-place-order-request';
import { HyperliquidPlaceOrderResponse } from '@/infra/hyperliqued/types/hyperliquid-place-order-response';
import { HyperliquidOpenOrder } from '@/infra/hyperliqued/types/hyperliquid-open-order';
import { HyperliquidHistoricalOrder } from '@/infra/hyperliqued/types/hyperliquid-historical-order';
import { HyperliquidOrderStatusFound } from '@/infra/hyperliqued/types/hyperliquid-order-status-response';
import { HyperliquidSymbol } from '@/infra/hyperliqued/types/hyperliquid-symbol';
import { HyperliquidSdkPlaceOrderResponse } from '@/infra/hyperliqued/types/hyperliquid-sdk-place-order-response';

/**
 * Hyperliquid Order Mapper
 *
 * Maps between domain types and Hyperliquid API types.
 * This mapper is internal to the secondary adapter.
 */
@Injectable()
export class HyperliquidOrderMapper {
    constructor(
        private readonly sdkService: HyperliquidSdkService,
        private readonly apiClient: HyperliquidApiClient,
    ) {}
    /**
     * Map domain ExchangePlaceOrderParams to Hyperliquid API request
     *
     * @param params - Order parameters to place
     * @param gridId - Client Order ID (hex-encoded gridId for tracking which grid this order belongs to)
     */
    toPlaceOrderRequest(
        params: ExchangePlaceOrderParams,
        gridId: string,
    ): HyperliquidPlaceOrderRequest {
        return {
            coin: params.symbol.toString(),
            is_buy: params.side === OrderSide.Buy,
            sz: params.amount.toNumber(),
            limit_px: params.price.toNumber(),
            reduce_only: false,
            cloid: gridId,
        };
    }

    /**
     * Map Hyperliquid API response to domain ExchangePlaceOrderResult
     */
    toExchangePlaceOrderResult(response: HyperliquidPlaceOrderResponse): ExchangePlaceOrderResult {
        const exchangeOrderId = response.response?.data?.statuses?.[0]?.filled?.oid?.toString();

        if (!exchangeOrderId) {
            return {
                exchangeOrderId: '',
                status: OrderStatus.Failed,
                error: 'No order ID in response',
            };
        }

        return {
            exchangeOrderId,
            status: OrderStatus.Placed,
        };
    }

    /**
     * Map Hyperliquid SDK response to domain ExchangePlaceOrderResult
     * SDK response format: { status: 'ok', response: { type: 'order', data: { statuses: [...] } } }
     */
    toExchangePlaceOrderResultFromSdk(
        response: HyperliquidSdkPlaceOrderResponse,
    ): ExchangePlaceOrderResult {
        const firstStatus = response?.response?.data?.statuses?.[0];

        if (firstStatus?.error) {
            return {
                exchangeOrderId: '',
                status: OrderStatus.Failed,
                error: firstStatus.error,
            };
        }

        // Order can be resting (limit order) or filled (market order or immediately filled)
        const exchangeOrderId =
            firstStatus?.resting?.oid?.toString() || firstStatus?.filled?.oid?.toString();

        if (!exchangeOrderId) {
            return {
                exchangeOrderId: '',
                status: OrderStatus.Failed,
                error: 'No order ID in response',
            };
        }

        // If filled, order was executed immediately
        if (firstStatus?.filled) {
            return {
                exchangeOrderId,
                status: OrderStatus.Filled,
            };
        }

        return {
            exchangeOrderId,
            status: OrderStatus.Placed,
        };
    }

    /**
     * Map Hyperliquid API open order to domain OpenOrder
     */
    toOpenOrder(apiOrder: HyperliquidOpenOrder): ExchangeOpenOrder {
        const resolvedCoin = this.sdkService.resolveSpotSymbol(apiOrder.coin);
        const symbol = TradingSymbol.create(resolvedCoin);
        const side = apiOrder.side === 'B' ? OrderSide.Buy : OrderSide.Sell;
        const price = Price.from(parseFloat(apiOrder.limitPx));
        const amount = Decimal.from(apiOrder.sz);
        const origAmount = Decimal.from(apiOrder.origSz ?? apiOrder.sz);
        const filledAmount = origAmount.sub(amount);

        // Parse cloid to ExchangeCloid and GridId if present
        const cloid = apiOrder.cloid ? ExchangeCloid.fromString(apiOrder.cloid) : undefined;

        return {
            id: apiOrder.oid.toString(),
            cloid,
            symbol,
            type: OrderType.Limit,
            side,
            price,
            amount: origAmount,
            filledAmount,
            status: ExchangeOrderStatus.OPEN,
            reduceOnly: apiOrder.reduceOnly ?? false,
            placedAt: apiOrder.timestamp,
        };
    }

    /**
     * Map array of Hyperliquid API open orders to domain OpenOrder array
     *
     * @param apiOrders - Array of open orders from Hyperliquid API
     * @returns Array of domain ExchangeOpenOrder objects
     */
    toOpenOrders(apiOrders: HyperliquidOpenOrder[]): ExchangeOpenOrder[] {
        return apiOrders.map((order) => this.toOpenOrder(order));
    }

    /**
     * Map Hyperliquid historical order to domain ExchangeOrderInfo
     */
    toExchangeOrderInfo(apiOrder: HyperliquidHistoricalOrder): ExchangeOrderInfo;
    /**
     * Map order status API response to domain ExchangeOrderInfo
     */
    toExchangeOrderInfo(statusData: HyperliquidOrderStatusFound): ExchangeOrderInfo;
    toExchangeOrderInfo(
        input: HyperliquidHistoricalOrder | HyperliquidOrderStatusFound,
    ): ExchangeOrderInfo {
        // Check if it's order status API response (has nested order.order structure)
        if ('status' in input && input.status === 'order') {
            // HyperliquidOrderStatusFound has nested order.order.oid and order.status
            const statusData = input as HyperliquidOrderStatusFound;
            return {
                exchangeOrderId: statusData.order.order.oid.toString(),
                status: statusData.order.status as ExchangeOrderStatus,
                statusTimestamp: statusData.order.statusTimestamp,
            };
        }

        // HyperliquidHistoricalOrder has flat order.oid and top-level status
        const historicalOrder = input as HyperliquidHistoricalOrder;
        return {
            exchangeOrderId: historicalOrder.order.oid.toString(),
            status: historicalOrder.status as ExchangeOrderStatus,
            statusTimestamp: historicalOrder.statusTimestamp,
        };
    }

    /**
     * Build SDK place order request parameters
     *
     * @param params - Domain order parameters
     * @returns SDK-compatible order request object
     */
    toSdkPlaceOrderRequest(params: ExchangePlaceOrderParams): {
        coin: string;
        is_buy: boolean;
        sz: number;
        limit_px: number;
        order_type: { limit: { tif: 'Gtc' } };
        reduce_only: boolean;
        cloid?: string;
    } {
        const symbol = params.symbol.toString();
        const coin = HyperliquidSymbol.toSpotFormat(symbol);
        const isBuy = params.side === OrderSide.Buy;
        const cloid = params.orderId ? ExchangeCloid.create(params.orderId).toString() : undefined;

        // Get size decimals for this token and round accordingly
        const szDecimals = this.apiClient.getSzDecimals(symbol);
        const sz = this.roundToDecimals(params.amount.toNumber(), szDecimals);
        const limitPx = this.roundToDecimals(params.price.toNumber(), szDecimals);

        return {
            coin,
            is_buy: isBuy,
            sz,
            limit_px: limitPx,
            order_type: { limit: { tif: 'Gtc' as const } },
            reduce_only: false,
            ...(cloid && { cloid }),
        };
    }

    /**
     * Round number to specified decimal places
     */
    private roundToDecimals(value: number, decimals: number): number {
        const multiplier = Math.pow(10, decimals);
        return Math.round(value * multiplier) / multiplier;
    }

    /**
     * Build SDK cancel order request parameters
     *
     * @param symbol - Trading symbol
     * @param exchangeOrderId - Exchange order ID
     * @returns SDK-compatible cancel request object
     */
    toSdkCancelOrderRequest(
        symbol: TradingSymbol,
        exchangeOrderId: string,
    ): {
        coin: string;
        o: number;
    } {
        return {
            coin: HyperliquidSymbol.toSpotFormat(symbol.toString()),
            o: parseInt(exchangeOrderId, 10),
        };
    }

    /**
     * Build SDK cancel all orders request parameter
     *
     * @param symbol - Trading symbol
     * @returns Hyperliquid coin identifier for cancel all operation
     */
    toSdkCancelAllRequest(symbol: TradingSymbol): string {
        return HyperliquidSymbol.toSpotFormat(symbol.toString());
    }
}
