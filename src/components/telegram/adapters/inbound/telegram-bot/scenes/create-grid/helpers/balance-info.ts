import { Decimal } from '@domain/models/primitives/decimal';
import { TradingApiPort } from '@components/trading/api/trading-api.port';
import { countBuySellLevels } from '@components/trading/api/count-buy-sell-levels';

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

    const { buyLevels: buyCount, sellLevels: sellCount } = countBuySellLevels(
        levels,
        lowerPrice,
        upperPrice,
        currentPrice,
    );
    const totalLevels = levels + 1;
    const buyRatio = buyCount / totalLevels;
    const sellRatio = sellCount / totalLevels;

    const maxFromUsdc =
        buyRatio > 0 ? usdcBalance.div(Decimal.from(buyRatio)) : Decimal.from(Infinity);
    const maxFromBase =
        sellRatio > 0 ? baseInUsdc.div(Decimal.from(sellRatio)) : Decimal.from(Infinity);
    const suggestedMax = maxFromUsdc.lt(maxFromBase)
        ? maxFromUsdc.toNumber()
        : maxFromBase.toNumber();
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
