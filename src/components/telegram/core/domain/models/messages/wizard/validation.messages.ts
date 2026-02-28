import { EMOJI } from '../../constants/emoji.constants';
import { Decimal } from '@domain/models/primitives/decimal';
import { PriceFormatter } from '../../formatters/price.formatter';
import { formatFiat } from '../../formatters/format-fiat';

export class ValidationMessages {
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
    ): string {
        const minTotal = formatFiat(minInvestment * levels);
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
}
