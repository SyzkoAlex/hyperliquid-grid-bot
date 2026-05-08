import { EMOJI } from '../../constants/emoji';
import { WIZARD_CONFIG } from '../../constants/wizard-config';
import { Decimal } from '@domain/models/primitives/decimal';
import { PriceFormatter } from '../../formatters/price.formatter';
import { formatFiat } from '../../formatters/format-fiat';

export class ValidationTexts {
    static invalidPrice(): string {
        return `${EMOJI.ERROR} Invalid price. Please enter a positive number:`;
    }

    static invalidNumber(): string {
        return `${EMOJI.ERROR} Invalid input. Please enter a number:`;
    }

    static invalidAmount(minInvestment: number): string {
        return `${EMOJI.ERROR} Invalid amount. Minimum investment: ${minInvestment} USDC\n\nPlease enter a valid amount:`;
    }

    static lowerPriceMustBeLess(upperPrice: number): string {
        return `${EMOJI.ERROR} Lower price must be less than upper price (${PriceFormatter.format(upperPrice)})\n\nPlease enter a valid price:`;
    }

    static invalidLevelsRange(min: number, max: number): string {
        return `${EMOJI.ERROR} Invalid number of levels. Must be between ${min} and ${max}`;
    }

    static orderSizeTooSmall(
        levels: number,
        perOrderAmount: number,
        minInvestment: number,
        minRequiredTotal?: number,
    ): string {
        const minTotal =
            minRequiredTotal !== undefined
                ? formatFiat(minRequiredTotal)
                : formatFiat(minInvestment * levels);
        return (
            `${EMOJI.ERROR} Order size too small!\n\n` +
            `With ${levels} levels, each order would be ${formatFiat(perOrderAmount)} USDC.\n` +
            `Minimum per order: ${minInvestment} USDC\n\n` +
            `Please increase your investment to at least ${minTotal} USDC.`
        );
    }

    static insufficientBalance(
        symbol: string,
        usdcBalance: Decimal,
        baseBalance: Decimal,
        baseInUsdc: Decimal,
        totalBalance: Decimal,
        currentPrice: number,
        requiredUsdc: Decimal,
        requiredBase: Decimal,
        usdcShortfall: Decimal | null,
        baseShortfall: Decimal | null,
    ): string {
        let message = `${EMOJI.ERROR} Insufficient balance!\n\n`;
        message += `${EMOJI.MONEY} Your balance:\n`;
        message += `  • USDC: ${usdcBalance.toString()}\n`;
        message += `  • ${symbol}: ${baseBalance.toString()} (${formatFiat(baseInUsdc.toNumber())} USDC)\n\n`;
        message += `${symbol} price: $${formatFiat(currentPrice)}\n`;
        message += `Total balance: ${formatFiat(totalBalance.toNumber())} USDC\n\n`;
        message += `${EMOJI.CHART_UP} Required for full grid:\n`;
        message += `  • USDC: ${requiredUsdc.toString()}\n`;
        message += `  • ${symbol}: ${requiredBase.toString()}\n\n`;

        if (usdcShortfall && usdcShortfall.gt(Decimal.zero())) {
            message += `${EMOJI.WARNING} USDC shortfall: ${formatFiat(usdcShortfall.toNumber())} USDC\n`;
        }
        if (baseShortfall && baseShortfall.gt(Decimal.zero())) {
            const baseShortfallUsdc = baseShortfall.mul(Decimal.from(currentPrice));
            message += `${EMOJI.WARNING} ${symbol} shortfall: ${baseShortfall.toFixed(6)} (~${formatFiat(baseShortfallUsdc.toNumber())} USDC)\n`;
        }

        message += `\nPlease reduce your investment or add more funds.`;
        return message;
    }

    static tokenNotFound(symbol: string): string {
        return `${EMOJI.ERROR} Token ${symbol} not found. Please try another token.`;
    }

    static invalidTokenFormat(): string {
        return `${EMOJI.ERROR} Invalid token format. Please try another token.`;
    }

    static fetchDataFailed(symbol: string): string {
        return `${EMOJI.ERROR} Failed to fetch data for ${symbol}. Please try again later.`;
    }

    static invalidState(): string {
        return `${EMOJI.ERROR} Invalid state. Please start over.`;
    }

    static invalidGridConfig(): string {
        return `${EMOJI.ERROR} Invalid grid configuration. Please start over.`;
    }

    static insufficientBalanceForGrid(
        levels: number,
        minRequired: number,
        suggestedMax: number,
    ): string {
        const ordersCount = levels + 1;
        const shortfall = Math.ceil(minRequired - suggestedMax);
        const maxAffordableLevels = Math.floor(suggestedMax / WIZARD_CONFIG.MIN_INVESTMENT) - 1;
        const canReduceLevels = maxAffordableLevels >= WIZARD_CONFIG.MIN_LEVELS;

        let options = `  • Add at least ${shortfall} more USDC to your balance`;
        if (canReduceLevels) {
            options = `  • Reduce to ${maxAffordableLevels} levels or fewer\n` + options;
        }

        return (
            `${EMOJI.WARNING} Insufficient balance for grid creation!\n\n` +
            `With ${levels} levels, minimum investment is ${minRequired} USDC ` +
            `(${WIZARD_CONFIG.MIN_INVESTMENT} USDC per order × ${ordersCount} orders).\n` +
            `Your balance supports at most ~${suggestedMax} USDC for this grid configuration.\n\n` +
            `Options:\n` +
            options
        );
    }

    static zeroBaseBalance(symbol: string, usdcBalance: Decimal): string {
        return (
            `${EMOJI.WARNING} You have no ${symbol} tokens!\n\n` +
            `${EMOJI.MONEY} Your balance:\n` +
            `  • USDC: ${usdcBalance.toString()}\n` +
            `  • ${symbol}: 0\n\n` +
            `Grid requires both USDC and ${symbol}.\n` +
            `Please buy some ${symbol} first, then create the grid.`
        );
    }

    static stopLossMustBePositive(): string {
        return `${EMOJI.ERROR} Stop-loss price must be a positive number. Please try again:`;
    }

    static stopLossMustBeBelowLower(lowerPrice: number): string {
        return (
            `${EMOJI.ERROR} Stop-loss price must be strictly below your lower bound ` +
            `(${PriceFormatter.format(lowerPrice)}). Please enter a lower price:`
        );
    }

    static stopLossTooCloseToLower(lowerPrice: number): string {
        return (
            `${EMOJI.ERROR} Stop-loss price is too close to your lower bound ` +
            `(${PriceFormatter.format(lowerPrice)}). ` +
            `A minimum distance of 0.5% is required to avoid triggering on grid noise. ` +
            `Please enter a price at least ${PriceFormatter.format(lowerPrice * 0.995)} or lower:`
        );
    }

    static zeroUsdcBalance(symbol: string, baseBalance: Decimal): string {
        return (
            `${EMOJI.WARNING} You have no USDC!\n\n` +
            `${EMOJI.MONEY} Your balance:\n` +
            `  • USDC: 0\n` +
            `  • ${symbol}: ${baseBalance.toString()}\n\n` +
            `Grid requires both USDC and ${symbol}.\n` +
            `Please add USDC first, then create the grid.`
        );
    }
}
