import { TradingApiPort } from '@components/trading/api/trading-api.port';
import { WIZARD_CONFIG } from '@components/telegram/core/domain/models/constants/wizard-config';
import { ValidationTexts } from '@components/telegram/core/domain/models/messages/wizard/validation.texts';
import { swapHintLine } from '@components/telegram/core/domain/models/messages/wizard/swap-hint';
import { SwapMessages } from '@components/telegram/core/domain/models/messages/wizard/swap.messages';
import { OptimalSwapDto } from '@components/trading/api/dto/optimal-swap.dto';
import { fetchBalanceInfo, BalanceInfo } from './balance-info';
import { buildEligibleSwapOffer } from './build-eligible-swap-offer';

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
        lowerPrice: number;
        upperPrice: number;
    }): string;
}

interface InvestmentViewResult {
    readonly body: string;
    readonly suggestedMax: number | null;
    readonly swapOffer: OptimalSwapDto | null;
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
    let swapOffer: OptimalSwapDto | null = null;
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

        const eligibleSwap = buildEligibleSwapOffer(tradingApi, {
            symbol,
            usdcBalance: balanceInfo.usdcBalance.toNumber(),
            baseBalance: balanceInfo.baseBalance.toNumber(),
            currentPrice: balanceInfo.currentPrice,
            lowerPrice,
            upperPrice,
            levels,
        });
        const hint = swapHintLine(symbol, eligibleSwap);

        if (balanceInfo.baseBalance.isZero()) {
            if (!balanceInfo.baseHold.isZero()) {
                body = ValidationTexts.baseLockedInOrders(
                    symbol,
                    balanceInfo.baseBalance,
                    balanceInfo.baseHold,
                );
            } else {
                body = ValidationTexts.zeroBaseBalance(symbol, balanceInfo.usdcBalance, hint);
                swapOffer = eligibleSwap;
            }
        } else if (balanceInfo.usdcBalance.isZero()) {
            body = ValidationTexts.zeroUsdcBalance(symbol, balanceInfo.baseBalance, hint);
            swapOffer = eligibleSwap;
        } else {
            const minRequired = (levels + 1) * WIZARD_CONFIG.MIN_INVESTMENT;
            if (balanceInfo.suggestedMaxRounded < minRequired) {
                if (!balanceInfo.baseHold.isZero()) {
                    body = ValidationTexts.baseLockedInOrders(
                        symbol,
                        balanceInfo.baseBalance,
                        balanceInfo.baseHold,
                    );
                } else {
                    body = ValidationTexts.insufficientBalanceForGrid(
                        levels,
                        minRequired,
                        balanceInfo.suggestedMaxRounded,
                        hint,
                    );
                    swapOffer = eligibleSwap;
                }
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
                    lowerPrice,
                    upperPrice,
                });
                // Proactive (maximize-mode) hint: show when balances are available but asymmetric.
                if (eligibleSwap) {
                    const proactiveHint = SwapMessages.proactiveHint(
                        symbol,
                        eligibleSwap,
                        balanceInfo.suggestedMaxRounded,
                        balanceInfo.totalBalance.toNumber(),
                    );
                    body = `${body}\n\n${proactiveHint}`;
                    swapOffer = eligibleSwap;
                }
            }
        }
    } catch {
        // Silent fallback — callers render a generic prompt; the error itself
        // is not actionable here, so we swallow it and let the step re-try on
        // the next render cycle.
    }

    return { body, suggestedMax, swapOffer };
}
