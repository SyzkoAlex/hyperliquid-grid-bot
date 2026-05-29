import { Decimal } from '@domain/models/primitives/decimal';
import { SwapSide } from '@components/trading/core/domain/models/swap/swap-side';
import { L2Touch } from '@components/trading/core/domain/models/swap/l2-touch';

export interface SpotSwapParams {
    symbol: string;
    side: SwapSide;
    /** For UsdcToBase, amount in USDC to spend. For BaseToUsdc, amount in BASE to sell. */
    amount: Decimal;
    l2Touch: L2Touch;
    accountAddress: string;
}
