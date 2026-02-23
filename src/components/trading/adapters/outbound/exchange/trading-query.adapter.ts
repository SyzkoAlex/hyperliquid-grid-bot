import { Injectable, Inject } from '@nestjs/common';
import { TradingQueryPort } from '@components/trading/core/application/ports/trading-query.port';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Price } from '@domain/models/primitives/price';
import { UserState } from '@domain/models/user-state/user-state';
import {
    EXCHANGE_INFO_PORT,
    ExchangeInfoPort,
} from '@components/trading/core/application/ports/exchange-info.port';

@Injectable()
export class TradingQueryAdapter implements TradingQueryPort {
    constructor(@Inject(EXCHANGE_INFO_PORT) private readonly infoClient: ExchangeInfoPort) {}

    getCurrentPrice(symbol: TradingSymbol): Promise<Price> {
        return this.infoClient.getCurrentPrice(symbol);
    }

    getUserSpotState(user: string): Promise<UserState> {
        return this.infoClient.getUserSpotState(user);
    }

    pairExists(symbol: TradingSymbol): Promise<boolean> {
        return this.infoClient.pairExists(symbol);
    }
}
