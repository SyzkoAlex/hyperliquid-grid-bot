import { SwapSide } from '@components/trading/core/domain/models/swap/swap-side';

export { SwapSide };

export interface OptimalSwapDto {
    side: SwapSide;
    amountUsdc: number;
    expectedReceived: number;
}
