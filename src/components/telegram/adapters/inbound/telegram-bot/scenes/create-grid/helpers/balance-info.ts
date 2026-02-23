import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Decimal } from '@domain/models/primitives/decimal';
import { ExchangeInfoPort } from '@components/telegram/core/application/ports/exchange-info.port';
import { UserBalanceExtractorService } from '@domain/services/user-balance-extractor/user-balance-extractor.service';

export interface BalanceInfo {
    usdcBalance: Decimal;
    baseBalance: Decimal;
    baseInUsdc: Decimal;
    totalBalance: Decimal;
    currentPrice: number;
    suggestedMaxRounded: number;
}

export async function fetchBalanceInfo(
    hyperliquidClient: ExchangeInfoPort,
    userBalanceExtractor: UserBalanceExtractorService,
    accountAddress: string,
    symbol: string,
): Promise<BalanceInfo> {
    const userState = await hyperliquidClient.getUserSpotState(accountAddress);
    const { usdcBalance, baseBalance } = userBalanceExtractor.extractBalances(userState, symbol);

    const tradingSymbol = TradingSymbol.fromString(symbol);
    const price = await hyperliquidClient.getCurrentPrice(tradingSymbol);
    const currentPrice = price.toNumber();

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
