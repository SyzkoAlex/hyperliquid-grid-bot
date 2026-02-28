import { Decimal } from '@domain/models/primitives/decimal';
import { AssetPosition } from './asset-position';

/**
 * User State Value Object
 * Represents complete user spot account state (balances)
 */
export class UserState {
    private constructor(
        private readonly _withdrawableBalance: Decimal,
        private readonly _assetPositions: ReadonlyArray<AssetPosition>,
        private readonly _usdcTotal: Decimal,
        private readonly _usdcHold: Decimal,
    ) {}

    static create(params: {
        withdrawableBalance: Decimal;
        assetPositions: AssetPosition[];
        usdcTotal?: Decimal;
        usdcHold?: Decimal;
    }): UserState {
        return new UserState(
            params.withdrawableBalance,
            params.assetPositions,
            params.usdcTotal ?? params.withdrawableBalance,
            params.usdcHold ?? Decimal.zero(),
        );
    }

    get withdrawableBalance(): Decimal {
        return this._withdrawableBalance;
    }

    get usdcTotal(): Decimal {
        return this._usdcTotal;
    }

    get usdcHold(): Decimal {
        return this._usdcHold;
    }

    get assetPositions(): ReadonlyArray<AssetPosition> {
        return this._assetPositions;
    }

    /**
     * Find position by symbol
     */
    findPosition(symbol: string): AssetPosition | undefined {
        return this._assetPositions.find((p) => p.symbol.toString() === symbol);
    }
}
