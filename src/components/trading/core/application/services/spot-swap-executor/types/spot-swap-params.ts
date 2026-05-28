import { Decimal } from '@domain/models/primitives/decimal';
import { SwapSide } from '@components/trading/core/domain/models/swap/swap-side';

export interface SpotSwapParams {
    symbol: string;
    side: SwapSide;
    /** For UsdcToBase, amount in USDC to spend. For BaseToUsdc, amount in BASE to sell. */
    amount: Decimal;
    currentMid: number;
    accountAddress: string;
}
