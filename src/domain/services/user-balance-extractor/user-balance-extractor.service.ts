import { Injectable } from '@nestjs/common';
import { Decimal } from '@domain/models/primitives/decimal';
import { logger } from '@infra/logger/logger';
import { UserBalances } from '@domain/models/user-balances';
import { UserState } from '@domain/models/user-state/user-state';

/**
 * User Balance Extractor Service
 *
 * Extracts user balances from UserState domain object.
 *
 * ## What we extract:
 *
 * ### 1. USDC Balance
 * Extracted from withdrawable balance:
 * ```
 * withdrawableBalance = 5000.50  → usdcBalance = 5000.50 USDC
 * ```
 * This is the "free" balance available for:
 * - Placing new orders
 * - Withdrawing to wallet
 * - Not locked in orders
 *
 * ### 2. Base Token Balance (e.g., BTC, ETH)
 * Extracted from asset positions:
 * ```
 * assetPositions = [
 *   AssetPosition(symbol: "BTC", size: 0.15),  → Found!
 *   AssetPosition(symbol: "ETH", size: 2.5)
 * ]
 * ```
 *
 * ### Edge Cases:
 * - Missing withdrawable balance → return 0 USDC
 * - Asset not in positions → return 0 tokens
 *
 * ### Example:
 * ```
 * Input (UserState domain object):
 * UserState {
 *   withdrawableBalance: 5000.50,
 *   assetPositions: [
 *     AssetPosition(symbol: "BTC", size: 0.15)
 *   ]
 * }
 *
 * Output (for symbol="BTC"):
 * {
 *   usdcBalance: 5000.50,
 *   baseBalance: 0.15
 * }
 * ```
 */
@Injectable()
export class UserBalanceExtractorService {
    private readonly logger = logger.child({ context: UserBalanceExtractorService.name });

    /**
     * Extract user balances from UserState domain object
     *
     * @param userState - User state domain object
     * @param symbol - Base token symbol (e.g., "BTC", "ETH")
     * @returns User balances (USDC and base token)
     */
    extractBalances(userState: UserState, symbol: string): UserBalances {
        const usdcBalance = userState.withdrawableBalance;
        const baseBalance = this.extractBaseBalance(userState, symbol);

        this.logger.info(
            { usdcBalance: usdcBalance.toString(), baseBalance: baseBalance.toString() },
            'User balances extracted',
        );

        return { usdcBalance, baseBalance };
    }

    /**
     * Extract base token balance from user state
     *
     * Searches through asset positions to find the asset
     * with matching symbol and extracts the available size.
     *
     * @param userState - User state domain object
     * @param symbol - Token symbol to search for (e.g., "BTC")
     * @returns Token balance as Decimal
     */
    private extractBaseBalance(userState: UserState, symbol: string): Decimal {
        const position = userState.findPosition(symbol);
        return position?.size ?? Decimal.zero();
    }
}
