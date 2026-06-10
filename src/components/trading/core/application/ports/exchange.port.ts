import { Price } from '@domain/models/primitives/price';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { L2Touch } from '@components/trading/core/domain/models/swap/l2-touch';
import { ExchangePlaceOrderParams } from '@components/trading/core/domain/models/exchange-order/exchange-place-order-params';
import { ExchangePlaceOrderResult } from '@components/trading/core/domain/models/exchange-order/exchange-place-order-result';
import { ExchangeCancelOrderParams } from '@components/trading/core/domain/models/exchange-order/exchange-cancel-order-params';
import { ExchangeCancelOrderResult } from '@components/trading/core/domain/models/exchange-order/exchange-cancel-order-result';
import { ExchangeOpenOrder } from '@components/trading/core/domain/models/exchange-order/exchange-open-order';
import { ExchangeOrderInfo } from '@components/trading/core/domain/models/exchange-order/exchange-order-info';
import { ExchangeOrderFill } from '@components/trading/core/domain/models/exchange-order/exchange-order-fill';
import { UserState } from '@components/trading/core/domain/models/user-state/user-state';
import { ExchangePlaceMarketSellParams } from '@components/trading/core/domain/models/exchange-order/exchange-place-market-sell-params';
import { ExchangePlaceMarketBuyParams } from '@components/trading/core/domain/models/exchange-order/exchange-place-market-buy-params';
import { TokenDescriptor } from '@components/trading/core/domain/models/token/token-descriptor';

export const EXCHANGE_PORT = Symbol('EXCHANGE_PORT');

export interface ExchangePort {
    placeSpotOrder(params: ExchangePlaceOrderParams): Promise<ExchangePlaceOrderResult>;
    placeSpotMarketSell(params: ExchangePlaceMarketSellParams): Promise<ExchangePlaceOrderResult>;
    placeSpotMarketBuy(params: ExchangePlaceMarketBuyParams): Promise<ExchangePlaceOrderResult>;
    cancelSpotOrder(params: ExchangeCancelOrderParams): Promise<ExchangeCancelOrderResult>;
    getCurrentPrice(symbol: TradingSymbol): Promise<Price>;
    getL2Touch(symbol: TradingSymbol): Promise<L2Touch>;
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
    getTopSymbolsByVolume(limit: number): Promise<TokenDescriptor[]>;
}
