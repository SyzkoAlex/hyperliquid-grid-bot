import { TradingApiPort } from '@components/trading/api/trading-api.port';
import { WIZARD_CONFIG } from '@components/telegram/core/domain/models/constants/wizard-config';
import { ValidationTexts } from '@components/telegram/core/domain/models/messages/wizard/validation.texts';
import { fetchBalanceInfo } from './balance-info';
import { BalanceInfo } from './balance-info';

interface InvestmentPromptFactory {
    fallback(): string;
    withBalance(info: {
        symbol: string;
        usdcBalance: BalanceInfo['usdcBalance'];
        baseBalance: BalanceInfo['baseBalance'];
        baseInUsdc: BalanceInfo['baseInUsdc'];
        totalBalance: BalanceInfo['totalBalance'];
        currentPrice: number;
        suggestedMax: number;
    }): string;
}

interface InvestmentViewResult {
    readonly body: string;
    readonly suggestedMax: number | null;
}

export async function buildInvestmentView(
    tradingApi: TradingApiPort,
    accountAddress: string,
    symbol: string,
    levels: number,
    lowerPrice: number,
    upperPrice: number,
    promptFactory: InvestmentPromptFactory,
): Promise<InvestmentViewResult> {
    let suggestedMax: number | null = null;
    let body = promptFactory.fallback();

    try {
        const balanceInfo = await fetchBalanceInfo(
            tradingApi,
            accountAddress,
            symbol,
            levels,
            lowerPrice,
            upperPrice,
        );

        if (balanceInfo.baseBalance.isZero()) {
            body = !balanceInfo.baseHold.isZero()
                ? ValidationTexts.baseLockedInOrders(
                      symbol,
                      balanceInfo.baseBalance,
                      balanceInfo.baseHold,
                  )
                : ValidationTexts.zeroBaseBalance(symbol, balanceInfo.usdcBalance);
        } else if (balanceInfo.usdcBalance.isZero()) {
            body = ValidationTexts.zeroUsdcBalance(symbol, balanceInfo.baseBalance);
        } else {
            const minRequired = (levels + 1) * WIZARD_CONFIG.MIN_INVESTMENT;
            if (balanceInfo.suggestedMaxRounded < minRequired) {
                body = !balanceInfo.baseHold.isZero()
                    ? ValidationTexts.baseLockedInOrders(
                          symbol,
                          balanceInfo.baseBalance,
                          balanceInfo.baseHold,
                      )
                    : ValidationTexts.insufficientBalanceForGrid(
                          levels,
                          minRequired,
                          balanceInfo.suggestedMaxRounded,
                      );
            } else {
                suggestedMax = balanceInfo.suggestedMaxRounded;
                body = promptFactory.withBalance({
                    symbol,
                    usdcBalance: balanceInfo.usdcBalance,
                    baseBalance: balanceInfo.baseBalance,
                    baseInUsdc: balanceInfo.baseInUsdc,
                    totalBalance: balanceInfo.totalBalance,
                    currentPrice: balanceInfo.currentPrice,
                    suggestedMax,
                });
            }
        }
    } catch {
        // Return fallback body on error; caller logs the error
    }

    return { body, suggestedMax };
}
