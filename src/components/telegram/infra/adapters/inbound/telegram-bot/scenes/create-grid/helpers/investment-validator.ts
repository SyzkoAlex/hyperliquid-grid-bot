import { InfoClientPort } from '@domain/ports/outbound/info-client.port';
import { UserBalanceExtractorService } from '@domain/services/user-balance-extractor/user-balance-extractor.service';
import { CapitalCalculatorService } from '@domain/services/capital-calculator/capital-calculator.service';
import { CapitalDistribution } from '@domain/models/capital-distribution';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Decimal } from '@domain/models/primitives/decimal';
import { GridMode } from '@domain/models/grid/grid-mode';
import { WIZARD_CONFIG } from '@components/telegram/domain/models/constants/wizard-config';
import { ValidationMessages } from '@components/telegram/domain/models/messages/wizard/validation.messages';

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
    hyperliquidClient: InfoClientPort,
    userBalanceExtractor: UserBalanceExtractorService,
    capitalCalculator: CapitalCalculatorService,
): Promise<InvestmentValidationResult> {
    const { investment, levels, symbol, upperPrice, lowerPrice, accountAddress } = params;

    if (isNaN(investment) || investment < WIZARD_CONFIG.MIN_INVESTMENT) {
        return {
            valid: false,
            errorMessage: ValidationMessages.invalidAmount(WIZARD_CONFIG.MIN_INVESTMENT),
        };
    }

    const perOrderAmount = investment / levels;
    if (perOrderAmount < WIZARD_CONFIG.MIN_INVESTMENT) {
        return {
            valid: false,
            errorMessage: ValidationMessages.orderSizeTooSmall(
                levels,
                perOrderAmount,
                WIZARD_CONFIG.MIN_INVESTMENT,
            ),
            showBackButton: true,
        };
    }

    const tradingSymbol = TradingSymbol.fromString(symbol);
    const currentPrice = await hyperliquidClient.getCurrentPrice(tradingSymbol);
    const userState = await hyperliquidClient.getUserSpotState(accountAddress);
    const { usdcBalance, baseBalance } = userBalanceExtractor.extractBalances(userState, symbol);

    const distribution = capitalCalculator.calculateDistribution({
        mode: GridMode.Neutral,
        totalInvestmentUSDC: investment,
        usdcBalance,
        baseBalance,
        currentPrice,
        lowerPrice,
        upperPrice,
    });

    const usdcShortfall = distribution.investmentUSDC.sub(usdcBalance);
    const baseShortfall = distribution.investmentBase.sub(baseBalance);
    const hasInsufficientBalance =
        usdcShortfall.gt(Decimal.zero()) || baseShortfall.gt(Decimal.zero());

    if (hasInsufficientBalance) {
        const baseInUsdc = baseBalance.mul(Decimal.from(currentPrice.toNumber()));
        const totalBalance = usdcBalance.add(baseInUsdc);

        return {
            valid: false,
            errorMessage: ValidationMessages.insufficientBalance(
                symbol,
                usdcBalance,
                baseBalance,
                baseInUsdc,
                totalBalance,
                currentPrice.toNumber(),
                distribution.investmentUSDC,
                distribution.investmentBase,
                usdcShortfall.gt(Decimal.zero()) ? usdcShortfall : null,
                baseShortfall.gt(Decimal.zero()) ? baseShortfall : null,
            ),
            showBackButton: true,
        };
    }

    return { valid: true, distribution };
}
