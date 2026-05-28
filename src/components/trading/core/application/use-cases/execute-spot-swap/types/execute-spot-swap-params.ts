import { SwapSide } from '@components/trading/core/domain/models/swap/swap-side';

export interface ExecuteSpotSwapParams {
    symbol: string;
    side: SwapSide;
    /** Notional in USDC (both directions). For BaseToUsdc this is the USDC value of base to sell. */
    amountUsdc: number;
    accountAddress: string;
}
