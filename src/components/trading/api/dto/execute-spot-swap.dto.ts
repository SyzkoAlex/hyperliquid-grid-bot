import { SwapSide } from '@components/trading/core/domain/models/swap/swap-side';

export interface ExecuteSpotSwapDto {
    symbol: string;
    side: SwapSide;
    amountUsdc: number;
    accountAddress: string;
}
