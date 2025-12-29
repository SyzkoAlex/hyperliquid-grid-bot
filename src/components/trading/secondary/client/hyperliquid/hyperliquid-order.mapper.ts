import { Injectable } from '@nestjs/common';
import { Symbol as TradingSymbol } from '../../../core/domain/common/symbol';
import { Price } from '../../../core/domain/common/price';
import { Decimal } from '@domain/primitives/decimal';
import { ExchangePlaceOrderParams } from '../../../core/domain/exchange-order/exchange-place-order-params';
import { ExchangePlaceOrderResult } from '../../../core/domain/exchange-order/exchange-place-order-result';
import { ExchangeOpenOrder } from '../../../core/domain/exchange-order/exchange-open-order';
import { OrderSide } from '../../../core/domain/order/order-side';
import { OrderType } from '../../../core/domain/order/order-type';
import { OrderStatus } from '../../../core/domain/order/order-status';
import { HyperliquidPlaceOrderRequest } from './types/hyperliquid-place-order-request';
import { HyperliquidPlaceOrderResponse } from './types/hyperliquid-place-order-response';
import { HyperliquidOpenOrder } from './types/hyperliquid-open-order';
import { HyperliquidHistoricalOrder } from './types/hyperliquid-historical-order';
import { HyperliquidOrderStatusFound } from './types/hyperliquid-order-status-response';
import { ExchangeOrderInfo } from '../../../core/domain/exchange-order/exchange-order-info';
import { ExchangeOrderStatus } from '../../../core/domain/exchange-order/exchange-order-status';
import { HyperliquidSymbol } from './types/hyperliquid-symbol';
import { ExchangeCloid } from '../../../core/domain/exchange-order/exchange-cloid';
import { HyperliquidSdkService } from './hyperliquid-sdk.service';
import { HyperliquidSdkPlaceOrderResponse } from './types/hyperliquid-sdk-place-order-response';

/**
 * Hyperliquid Order Mapper
 *
 * Maps between domain types and Hyperliquid API types.
 * This mapper is internal to the secondary adapter.
 */
@Injectable()
export class HyperliquidOrderMapper {
    constructor(private readonly sdkService: HyperliquidSdkService) {}
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
        const coin = HyperliquidSymbol.toSpotFormat(params.symbol);
        const isBuy = params.side === OrderSide.Buy;
        const sz = params.amount.toNumber();
        const limitPx = params.price.toNumber();
        const cloid = params.gridId ? ExchangeCloid.create(params.gridId).toString() : undefined;

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
            coin: HyperliquidSymbol.toSpotFormat(symbol),
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
        return HyperliquidSymbol.toSpotFormat(symbol);
    }
}
