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

    static invalidOrdersRange(min: number, max: number): string {
        return `${EMOJI.ERROR} Invalid number of orders. Must be between ${min} and ${max}`;
    }

    static orderSizeTooSmall(
        orderCount: number,
        perOrderAmount: number,
        minInvestment: number,
        minRequiredTotal?: number,
    ): string {
        const minTotal =
            minRequiredTotal !== undefined
                ? formatFiat(minRequiredTotal)
                : formatFiat(minInvestment * orderCount);
        return (
            `${EMOJI.ERROR} Order size too small!\n\n` +
            `With ${orderCount} orders, each order would be ${formatFiat(perOrderAmount)} USDC.\n` +
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
        swapHint?: string | null,
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

        if (swapHint) message += `\n${swapHint}\n`;
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
        orderCount: number,
        minRequired: number,
        suggestedMax: number,
        swapHint?: string | null,
    ): string {
        const shortfall = Math.ceil(minRequired - suggestedMax);
        const maxAffordableOrders = Math.floor(suggestedMax / WIZARD_CONFIG.MIN_INVESTMENT);
        const canReduceOrders = maxAffordableOrders >= WIZARD_CONFIG.MIN_ORDERS;

        let options = `  • Add at least ${shortfall} more USDC to your balance`;
        if (canReduceOrders) {
            options = `  • Reduce to ${maxAffordableOrders} orders or fewer\n` + options;
        }

        let message =
            `${EMOJI.WARNING} Insufficient balance for grid creation!\n\n` +
            `With ${orderCount} orders, minimum investment is ${minRequired} USDC ` +
            `(${WIZARD_CONFIG.MIN_INVESTMENT} USDC per order × ${orderCount} orders).\n` +
            `Your balance supports at most ~${suggestedMax} USDC for this grid configuration.\n\n` +
            `Options:\n` +
            options;
        if (swapHint) message += `\n\n${swapHint}`;
        return message;
    }

    static zeroBaseBalance(symbol: string, usdcBalance: Decimal, swapHint?: string | null): string {
        let message =
            `${EMOJI.WARNING} You have no ${symbol} tokens!\n\n` +
            `${EMOJI.MONEY} Your balance:\n` +
            `  • USDC: ${usdcBalance.toString()}\n` +
            `  • ${symbol}: 0\n\n` +
            `Grid requires both USDC and ${symbol}.\n` +
            `Please buy some ${symbol} first, then create the grid.`;
        if (swapHint) message += `\n\n${swapHint}`;
        return message;
    }

    static baseLockedInOrders(symbol: string, available: Decimal, hold: Decimal): string {
        return (
            `${EMOJI.WARNING} Your ${symbol} is locked in existing orders!\n\n` +
            `${EMOJI.MONEY} ${symbol} balance:\n` +
            `  • Available: ${available.toFixed(6)}\n` +
            `  • In orders: ${hold.toFixed(6)}\n\n` +
            `Cancel some existing orders to free up ${symbol}, then try again.`
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

    static enterCustomInvestment(): string {
        return 'Send a number to set your investment amount.';
    }

    static enterCustomUpperPrice(): string {
        return 'Send a number to set upper price.';
    }

    static enterCustomLowerPrice(): string {
        return 'Send a number to set lower price.';
    }

    static enterCustomStopLoss(): string {
        return 'Send a number to set stop-loss price.';
    }

    static zeroUsdcBalance(symbol: string, baseBalance: Decimal, swapHint?: string | null): string {
        let message =
            `${EMOJI.WARNING} You have no USDC!\n\n` +
            `${EMOJI.MONEY} Your balance:\n` +
            `  • USDC: 0\n` +
            `  • ${symbol}: ${baseBalance.toString()}\n\n` +
            `Grid requires both USDC and ${symbol}.\n` +
            `Please add USDC first, then create the grid.`;
        if (swapHint) message += `\n\n${swapHint}`;
        return message;
    }
}
