import { Decimal } from '@domain/models/primitives/decimal';
import { WIZARD_CONFIG } from '@components/telegram/core/domain/models/constants/wizard-config';
import { ValidationTexts } from '@components/telegram/core/domain/models/messages/wizard/validation.texts';
import { swapHintLine } from '@components/telegram/core/domain/models/messages/wizard/swap-hint';
import { TradingApiPort } from '@components/trading/api/trading-api.port';
import { countBuySellLevels } from '@components/trading/api/count-buy-sell-levels';
import { roundToCents } from './round-to-cents';
import { buildEligibleSwapOffer } from './build-eligible-swap-offer';
import { InvestmentValidationParams } from './investment-validation-params';
import { InvestmentValidationResult } from './investment-validation-result';

export async function validateInvestment(
    params: InvestmentValidationParams,
    tradingApi: TradingApiPort,
): Promise<InvestmentValidationResult> {
    const { investment, levels, symbol, upperPrice, lowerPrice, accountAddress } = params;

    if (isNaN(investment) || investment < WIZARD_CONFIG.MIN_INVESTMENT) {
        return {
            valid: false,
            errorMessage: ValidationTexts.invalidAmount(WIZARD_CONFIG.MIN_INVESTMENT),
        };
    }

    const perOrderAmount = investment / (levels + 1);
    if (perOrderAmount < WIZARD_CONFIG.MIN_INVESTMENT) {
        return {
            valid: false,
            errorMessage: ValidationTexts.orderSizeTooSmall(
                levels,
                perOrderAmount,
                WIZARD_CONFIG.MIN_INVESTMENT,
            ),
            showBackButton: true,
        };
    }

    const [userState, currentPriceNum] = await Promise.all([
        tradingApi.getUserSpotState(accountAddress),
        tradingApi.getCurrentPrice(symbol),
    ]);

    const usdcBalance = Decimal.from(userState.usdcBalance);
    const baseBalance = Decimal.from(userState.spotBalances[symbol] ?? 0);

    const distributionDto = tradingApi.calculateCapitalDistribution({
        symbol,
        levels,
        totalInvestmentUSDC: investment,
        usdcBalance: userState.usdcBalance,
        baseBalance: userState.spotBalances[symbol] ?? 0,
        currentPrice: currentPriceNum,
        lowerPrice,
        upperPrice,
    });

    const requiredUSDC = Decimal.from(distributionDto.requiredUSDC);
    const requiredBase = Decimal.from(distributionDto.requiredBase);

    const { buyLevels: buyCount, sellLevels: sellCount } = countBuySellLevels(
        levels,
        lowerPrice,
        upperPrice,
        currentPriceNum,
    );

    if (buyCount > 0 && sellCount > 0) {
        const minBuyNotional = requiredUSDC.div(Decimal.from(buyCount)).toNumber();
        const minSellNotional = requiredBase
            .mul(Decimal.from(currentPriceNum))
            .div(Decimal.from(sellCount))
            .toNumber();
        const minNotional = roundToCents(Math.min(minBuyNotional, minSellNotional));

        if (minNotional < WIZARD_CONFIG.MIN_INVESTMENT) {
            const minRequired = Math.ceil(
                investment * (WIZARD_CONFIG.MIN_INVESTMENT / minNotional),
            );
            return {
                valid: false,
                errorMessage: ValidationTexts.orderSizeTooSmall(
                    levels + 1,
                    minNotional,
                    WIZARD_CONFIG.MIN_INVESTMENT,
                    minRequired,
                ),
                showBackButton: true,
            };
        }
    }

    const usdcShortfall = requiredUSDC.sub(usdcBalance);
    const baseShortfall = requiredBase.sub(baseBalance);
    const hasInsufficientBalance =
        usdcShortfall.gt(Decimal.zero()) || baseShortfall.gt(Decimal.zero());

    if (hasInsufficientBalance) {
        const baseInUsdc = baseBalance.mul(Decimal.from(currentPriceNum));
        const totalBalance = usdcBalance.add(baseInUsdc);

        const eligibleSwapOffer = buildEligibleSwapOffer(tradingApi, {
            symbol,
            usdcBalance: userState.usdcBalance,
            baseBalance: userState.spotBalances[symbol] ?? 0,
            currentPrice: currentPriceNum,
            lowerPrice,
            upperPrice,
            levels,
        });
        const hint = swapHintLine(symbol, eligibleSwapOffer);

        return {
            valid: false,
            errorMessage: ValidationTexts.insufficientBalance(
                symbol,
                usdcBalance,
                baseBalance,
                baseInUsdc,
                totalBalance,
                currentPriceNum,
                requiredUSDC,
                requiredBase,
                usdcShortfall.gt(Decimal.zero()) ? usdcShortfall : null,
                baseShortfall.gt(Decimal.zero()) ? baseShortfall : null,
                hint,
            ),
            showBackButton: true,
            swapOffer: eligibleSwapOffer,
        };
    }

    return { valid: true, distribution: { requiredUSDC, requiredBase } };
}
