// SwapSide is a domain enum that is intentionally part of this component's
// public API contract — callers (e.g. Telegram) refer to it via this boundary
// rather than importing directly from the domain layer.
import { SwapSide } from '@components/trading/core/domain/models/swap/swap-side';

export { SwapSide };

export interface OptimalSwapDto {
    side: SwapSide;
    /** Worth of USDC to swap (positive). For BaseToUsdc this is the USDC value of the base
     *  being sold, computed at currentPrice — not a base-token quantity. */
    amountUsdc: number;
    /** Expected received amount in the destination leg, worst-case at currentPrice (no slippage applied here). */
    expectedReceived: number;
}
