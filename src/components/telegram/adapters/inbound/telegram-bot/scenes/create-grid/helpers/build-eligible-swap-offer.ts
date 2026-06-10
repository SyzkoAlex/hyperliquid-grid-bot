import { TradingApiPort } from '@components/trading/api/trading-api.port';
import { OptimalSwapDto } from '@components/trading/api/dto/optimal-swap.dto';

interface SwapParams {
    symbol: string;
    usdcBalance: number;
    baseBalance: number;
    currentPrice: number;
    lowerPrice: number;
    upperPrice: number;
    levels: number;
}

/**
 * Calculate the optimal swap offer, filtering it out if it falls below minOrderNotional.
 * Returns null when no rebalance is needed or the swap amount is too small to execute.
 */
export function buildEligibleSwapOffer(
    tradingApi: TradingApiPort,
    params: SwapParams,
): OptimalSwapDto | null {
    const optimalSwap = tradingApi.calculateOptimalSwap(params);
    if (!optimalSwap) return null;
    const minNotional = tradingApi.getMinOrderNotional();
    return optimalSwap.amountUsdc >= minNotional ? optimalSwap : null;
}
