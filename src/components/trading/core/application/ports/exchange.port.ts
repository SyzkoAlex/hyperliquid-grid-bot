import { Price } from '@domain/models/primitives/price';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { ExchangePlaceOrderParams } from '@components/trading/core/domain/models/exchange-order/exchange-place-order-params';
import { ExchangePlaceOrderResult } from '@components/trading/core/domain/models/exchange-order/exchange-place-order-result';
import { ExchangeCancelOrderParams } from '@components/trading/core/domain/models/exchange-order/exchange-cancel-order-params';
import { ExchangeCancelOrderResult } from '@components/trading/core/domain/models/exchange-order/exchange-cancel-order-result';
import { ExchangeOpenOrder } from '@components/trading/core/domain/models/exchange-order/exchange-open-order';
import { ExchangeOrderInfo } from '@components/trading/core/domain/models/exchange-order/exchange-order-info';
import { ExchangeOrderFill } from '@components/trading/core/domain/models/exchange-order/exchange-order-fill';
import { UserState } from '@components/trading/core/domain/models/user-state/user-state';
import { ExchangePlaceMarketSellParams } from '@components/trading/core/domain/models/exchange-order/exchange-place-market-sell-params';

export const EXCHANGE_PORT = Symbol('EXCHANGE_PORT');

export interface ExchangePort {
    placeSpotOrder(params: ExchangePlaceOrderParams): Promise<ExchangePlaceOrderResult>;
    placeSpotMarketSell(params: ExchangePlaceMarketSellParams): Promise<ExchangePlaceOrderResult>;
    cancelSpotOrder(params: ExchangeCancelOrderParams): Promise<ExchangeCancelOrderResult>;
    getCurrentPrice(symbol: TradingSymbol): Promise<Price>;
    getOpenSpotOrders(user: string): Promise<ExchangeOpenOrder[]>;
    getOrderStatus(user: string, oid: number | string): Promise<ExchangeOrderInfo | null>;
    getOrderFills(
        user: string,
        oid: number,
        startTime: number,
        endTime: number,
    ): Promise<ExchangeOrderFill[]>;
    getUserSpotState(user: string): Promise<UserState>;
    pairExists(symbol: TradingSymbol): Promise<boolean>;
    probeAgentApproval(accountAddress: string): Promise<{ approved: boolean }>;
    getSzDecimals(symbol: TradingSymbol): number;
}
