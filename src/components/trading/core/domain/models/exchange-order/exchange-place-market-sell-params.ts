import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Price } from '@domain/models/primitives/price';
import { Decimal } from '@domain/models/primitives/decimal';

export interface ExchangePlaceMarketSellParams {
    symbol: TradingSymbol;
    amount: Decimal;
    /** Marketable IOC price (e.g. currentMid * (1 - slippageCap)) */
    limitPrice: Price;
    /** Used as CLOID for the order */
    orderId: string;
    accountAddress: string;
}
