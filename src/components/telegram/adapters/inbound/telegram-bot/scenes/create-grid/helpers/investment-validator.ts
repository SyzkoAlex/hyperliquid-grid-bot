import { Decimal } from '@domain/models/primitives/decimal';

interface CapitalDistribution {
    investmentUSDC: Decimal;
    investmentBase: Decimal;
}
import { GridMode } from '@domain/models/grid/grid-mode';
import { WIZARD_CONFIG } from '@components/telegram/core/domain/models/constants/wizard-config';
import { ValidationTexts } from '@components/telegram/core/domain/models/messages/wizard/validation.texts';
import { TradingApiPort } from '@components/trading/api/trading-api.port';

export interface InvestmentValidationParams {
    investment: number;
    levels: number;
    symbol: string;
    upperPrice: number;
    lowerPrice: number;
    accountAddress: string;
}

export interface InvestmentValidationResult {
    valid: boolean;
    errorMessage?: string;
    showBackButton?: boolean;
    distribution?: CapitalDistribution;
}

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

    const perOrderAmount = investment / levels;
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
        mode: GridMode.Neutral,
        totalInvestmentUSDC: investment,
        usdcBalance: userState.usdcBalance,
        baseBalance: userState.spotBalances[symbol] ?? 0,
        currentPrice: currentPriceNum,
        lowerPrice,
        upperPrice,
    });

    const investmentUSDC = Decimal.from(distributionDto.investmentUSDC);
    const investmentBase = Decimal.from(distributionDto.investmentBase);

    const usdcShortfall = investmentUSDC.sub(usdcBalance);
    const baseShortfall = investmentBase.sub(baseBalance);
    const hasInsufficientBalance =
        usdcShortfall.gt(Decimal.zero()) || baseShortfall.gt(Decimal.zero());

    if (hasInsufficientBalance) {
        const baseInUsdc = baseBalance.mul(Decimal.from(currentPriceNum));
        const totalBalance = usdcBalance.add(baseInUsdc);

        return {
            valid: false,
            errorMessage: ValidationTexts.insufficientBalance(
                symbol,
                usdcBalance,
                baseBalance,
                baseInUsdc,
                totalBalance,
                currentPriceNum,
                investmentUSDC,
                investmentBase,
                usdcShortfall.gt(Decimal.zero()) ? usdcShortfall : null,
                baseShortfall.gt(Decimal.zero()) ? baseShortfall : null,
            ),
            showBackButton: true,
        };
    }

    return { valid: true, distribution: { investmentUSDC, investmentBase } };
}
