import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Decimal } from '@domain/models/primitives/decimal';

/**
 * Asset Position Value Object
 * Represents a spot balance in a specific asset (e.g., BTC, ETH)
 */
export class AssetPosition {
    private constructor(
        private readonly _symbol: TradingSymbol,
        private readonly _size: Decimal,
        private readonly _total: Decimal,
        private readonly _hold: Decimal,
    ) {}

    static create(params: {
        symbol: TradingSymbol;
        size: Decimal;
        total?: Decimal;
        hold?: Decimal;
    }): AssetPosition {
        return new AssetPosition(
            params.symbol,
            params.size,
            params.total ?? params.size,
            params.hold ?? Decimal.zero(),
        );
    }

    get symbol(): TradingSymbol {
        return this._symbol;
    }

    /** Available balance (total - hold) */
    get size(): Decimal {
        return this._size;
    }

    /** Total balance including held in orders */
    get total(): Decimal {
        return this._total;
    }

    /** Amount held in open orders */
    get hold(): Decimal {
        return this._hold;
    }
}
