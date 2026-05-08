import { Inject, Injectable } from '@nestjs/common';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import {
    EXCHANGE_PORT,
    ExchangePort,
} from '@components/trading/core/application/ports/exchange.port';

/** Fetches mid prices for a set of symbols in parallel; symbols with failed fetches are silently dropped from the result map. */
@Injectable()
export class SymbolPriceFetcherService {
    constructor(@Inject(EXCHANGE_PORT) private readonly exchange: ExchangePort) {}

    async fetchPrices(symbols: string[]): Promise<Map<string, number>> {
        const unique = [...new Set(symbols)];
        const priceBySymbol = new Map<string, number>();
        const results = await Promise.allSettled(
            unique.map(async (symbol) => {
                const price = await this.exchange.getCurrentPrice(TradingSymbol.create(symbol));
                return { symbol, price: price.toNumber() };
            }),
        );
        for (const result of results) {
            if (result.status === 'fulfilled') {
                priceBySymbol.set(result.value.symbol, result.value.price);
            }
        }
        return priceBySymbol;
    }
}
