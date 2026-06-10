import { SwapSide } from '@components/trading/core/domain/models/swap/swap-side';

export interface OptimalSwap {
    side: SwapSide;
    /** Worth of USDC to swap (positive). For BaseToUsdc this is the USDC value of the base
     *  being sold, computed at currentPrice. */
    amountUsdc: number;
    /** Expected received amount in the destination leg, worst-case at currentPrice (no slippage applied here). */
    expectedReceived: number;
}
