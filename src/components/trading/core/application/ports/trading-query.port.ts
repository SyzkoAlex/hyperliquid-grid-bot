import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Price } from '@domain/models/primitives/price';
import { UserState } from '@domain/models/user-state/user-state';

export const TRADING_QUERY_PORT = Symbol('TRADING_QUERY_PORT');

export interface TradingQueryPort {
    getCurrentPrice(symbol: TradingSymbol): Promise<Price>;
    getUserSpotState(user: string): Promise<UserState>;
    pairExists(symbol: TradingSymbol): Promise<boolean>;
}
