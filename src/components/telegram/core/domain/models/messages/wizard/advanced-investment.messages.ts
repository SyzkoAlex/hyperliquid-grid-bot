import { EMOJI } from '../../constants/emoji';
import { WIZARD_CONFIG } from '../../constants/wizard-config';
import { Decimal } from '@domain/models/primitives/decimal';
import { formatFiat } from '../../formatters/format-fiat';

export class AdvancedInvestmentMessages {
    static promptWithoutBalance(): string {
        return `How much USDC do you want to invest?\n\nMinimum: ${WIZARD_CONFIG.MIN_INVESTMENT} USDC per order`;
    }

    static promptWithBalance(
        symbol: string,
        usdcBalance: Decimal,
        baseBalance: Decimal,
        baseInUsdc: Decimal,
        totalBalance: Decimal,
        currentPrice: number,
        suggestedMax: number,
        levels: number,
    ): string {
        return (
            `${EMOJI.MONEY} Your balance:\n` +
            `  • USDC: ${usdcBalance.toString()}\n` +
            `  • ${symbol}: ${baseBalance.toString()} (${formatFiat(baseInUsdc.toNumber())} USDC)\n\n` +
            `${symbol} price: $${formatFiat(currentPrice)}\n\n` +
            `Total balance: ${formatFiat(totalBalance.toNumber())} USDC\n\n` +
            `How much USDC do you want to invest?\n\n` +
            `Minimum: ${WIZARD_CONFIG.MIN_INVESTMENT} USDC per order\n\n` +
            `${EMOJI.BULB} Suggested max: ~${suggestedMax} USDC (for ${levels} levels, neutral mode)\n` +
            `  (~${Math.floor(suggestedMax / 2)} USDC + ~${(suggestedMax / 2 / currentPrice).toFixed(4)} ${symbol})`
        );
    }

    static confirmation(investment: number): string {
        return `${EMOJI.SUCCESS} Investment set: ${investment} USDC`;
    }
}
