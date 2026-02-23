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
    ) {}

    static create(params: {
        withdrawableBalance: Decimal;
        assetPositions: AssetPosition[];
    }): UserState {
        return new UserState(params.withdrawableBalance, params.assetPositions);
    }

    get withdrawableBalance(): Decimal {
        return this._withdrawableBalance;
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
