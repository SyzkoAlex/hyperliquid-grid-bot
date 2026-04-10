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
    levels: number,
    lowerPrice: number,
    upperPrice: number,
): Promise<BalanceInfo> {
    const [userState, currentPrice] = await Promise.all([
        tradingApi.getUserSpotState(accountAddress),
        tradingApi.getCurrentPrice(symbol),
    ]);

    const usdcBalance = Decimal.from(userState.usdcBalance);
    const baseBalance = Decimal.from(userState.spotBalances[symbol] ?? 0);
    const baseInUsdc = baseBalance.mul(Decimal.from(currentPrice));
    const totalBalance = usdcBalance.add(baseInUsdc);

    const suggestedMaxRounded = tradingApi.calculateMaxInvestment({
        usdcBalance: userState.usdcBalance,
        baseBalance: userState.spotBalances[symbol] ?? 0,
        currentPrice,
        levels,
        lowerPrice,
        upperPrice,
    });

    return {
        usdcBalance,
        baseBalance,
        baseInUsdc,
        totalBalance,
        currentPrice,
        suggestedMaxRounded,
    };
}
