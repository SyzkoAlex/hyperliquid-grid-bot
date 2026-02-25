import { Decimal } from '@domain/models/primitives/decimal';
import { TradingApiPort } from '@components/trading/api/trading-api.port';

export interface BalanceInfo {
    usdcBalance: Decimal;
    baseBalance: Decimal;
    baseInUsdc: Decimal;
    totalBalance: Decimal;
    currentPrice: number;
    suggestedMaxRounded: number;
}

export async function fetchBalanceInfo(
    tradingApi: TradingApiPort,
    accountAddress: string,
    symbol: string,
): Promise<BalanceInfo> {
    const [userState, currentPrice] = await Promise.all([
        tradingApi.getUserSpotState(accountAddress),
        tradingApi.getCurrentPrice(symbol),
    ]);

    const usdcBalance = Decimal.from(userState.usdcBalance);
    const baseBalance = Decimal.from(userState.spotBalances[symbol] ?? 0);

    const baseInUsdc = baseBalance.mul(Decimal.from(currentPrice));
    const totalBalance = usdcBalance.add(baseInUsdc);

    const minBalance = usdcBalance.lt(baseInUsdc) ? usdcBalance : baseInUsdc;
    const suggestedMax = minBalance.mul(Decimal.from(2)).toNumber();
    const suggestedMaxRounded = Math.floor(suggestedMax);

    return {
        usdcBalance,
        baseBalance,
        baseInUsdc,
        totalBalance,
        currentPrice,
        suggestedMaxRounded,
    };
}
