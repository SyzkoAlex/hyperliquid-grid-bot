import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Price } from '@domain/models/primitives/price';
import { UserState } from '@domain/models/user-state/user-state';

export const EXCHANGE_INFO_PORT = Symbol('EXCHANGE_INFO_PORT');

export interface ExchangeInfoPort {
    getUserSpotState(user: string): Promise<UserState>;
    getCurrentPrice(symbol: TradingSymbol): Promise<Price>;
    pairExists(symbol: TradingSymbol): Promise<boolean>;
}
