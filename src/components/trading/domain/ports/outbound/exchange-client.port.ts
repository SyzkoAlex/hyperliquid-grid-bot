import { Price } from '@domain/models/primitives/price';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { ExchangePlaceOrderParams } from '../../models/exchange-order/exchange-place-order-params';
import { ExchangePlaceOrderResult } from '../../models/exchange-order/exchange-place-order-result';
import { ExchangeCancelOrderParams } from '../../models/exchange-order/exchange-cancel-order-params';
import { ExchangeCancelOrderResult } from '../../models/exchange-order/exchange-cancel-order-result';
import { ExchangeOpenOrder } from '../../models/exchange-order/exchange-open-order';
import { ExchangeOrderInfo } from '../../models/exchange-order/exchange-order-info';

export const EXCHANGE_CLIENT_PORT = Symbol('EXCHANGE_CLIENT_PORT');

export interface ExchangeClientPort {
    placeSpotOrder(params: ExchangePlaceOrderParams): Promise<ExchangePlaceOrderResult>;
    cancelSpotOrder(params: ExchangeCancelOrderParams): Promise<ExchangeCancelOrderResult>;
    getSpotPrice(symbol: TradingSymbol): Promise<Price>;
    getOpenSpotOrders(user: string): Promise<ExchangeOpenOrder[]>;
    getOrderStatus(user: string, oid: number | string): Promise<ExchangeOrderInfo | null>;
}
