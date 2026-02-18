import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Price } from '@domain/models/primitives/price';
import { UserState } from '@domain/models/user-state/user-state';

export const INFO_CLIENT_PORT = Symbol('INFO_CLIENT_PORT');

export interface InfoClientPort {
    getUserSpotState(user: string): Promise<UserState>;
    getCurrentPrice(symbol: TradingSymbol): Promise<Price>;
    pairExists(symbol: TradingSymbol): Promise<boolean>;
}
