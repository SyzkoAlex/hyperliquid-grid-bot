import { Injectable } from '@nestjs/common';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Decimal } from '@domain/models/primitives/decimal';
import { UserState } from '@domain/models/user-state/user-state';
import { AssetPosition } from '@domain/models/user-state/asset-position';
import { HyperliquidUserStateResponse } from '@/infra/hyperliqued/types/hyperliquid-user-state-response';

type HyperliquidSpotBalance = HyperliquidUserStateResponse['balances'][number];

/**
 * Hyperliquid User State Mapper
 *
 * Maps between Hyperliquid Spot API response types and domain types.
 */
@Injectable()
export class HyperliquidInfoMapper {
    /**
     * Map Hyperliquid spotClearinghouseState API response to domain UserState
     */
    toUserState(response: HyperliquidUserStateResponse): UserState {
        const usdcBalance = this.findUsdcBalance(response.balances);
        const assetPositions = this.toAssetPositions(response.balances);

        return UserState.create({
            withdrawableBalance: usdcBalance,
            assetPositions,
        });
    }

    /**
     * Find USDC balance from spot balances
     * Returns available balance (total - hold)
     */
    private findUsdcBalance(balances: HyperliquidSpotBalance[]): Decimal {
        const usdcBalance = balances.find((b) => b.coin === 'USDC');
        if (!usdcBalance) {
            return Decimal.zero();
        }

        const total = Decimal.from(parseFloat(usdcBalance.total || '0'));
        const hold = Decimal.from(parseFloat(usdcBalance.hold || '0'));

        return total.sub(hold);
    }

    /**
     * Map spot balances to asset positions (excluding USDC)
     */
    private toAssetPositions(balances: HyperliquidSpotBalance[]): AssetPosition[] {
        return balances.filter((b) => b.coin !== 'USDC').map((b) => this.toAssetPosition(b));
    }

    /**
     * Map API spot balance to domain AssetPosition
     */
    private toAssetPosition(balance: HyperliquidSpotBalance): AssetPosition {
        const symbol = TradingSymbol.create(balance.coin);
        const total = Decimal.from(parseFloat(balance.total || '0'));
        const hold = Decimal.from(parseFloat(balance.hold || '0'));

        // Available balance = total - hold
        const available = total.sub(hold);

        return AssetPosition.create({
            symbol,
            size: available,
            total,
            hold,
        });
    }
}
