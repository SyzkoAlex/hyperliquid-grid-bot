import { EMOJI } from '../../constants/emoji';
import { WIZARD_CONFIG } from '../../constants/wizard-config';
import { Decimal } from '@domain/models/primitives/decimal';
import { formatFiat } from '../../formatters/format-fiat';

interface InvestmentPromptParams {
    symbol: string;
    usdcBalance: Decimal;
    baseBalance: Decimal;
    baseInUsdc: Decimal;
    totalBalance: Decimal;
    currentPrice: number;
    suggestedMax: number;
    levels: number;
}

export class AdvancedInvestmentPromptMessage {
    readonly text: string;

    private constructor(params?: InvestmentPromptParams) {
        if (!params) {
            this.text = `How much USDC do you want to invest?\n\nMinimum: ${WIZARD_CONFIG.MIN_INVESTMENT} USDC per order`;
            return;
        }

        const {
            symbol,
            usdcBalance,
            baseBalance,
            baseInUsdc,
            totalBalance,
            currentPrice,
            suggestedMax,
            levels,
        } = params;
        this.text =
            `${EMOJI.MONEY} Your balance:\n` +
            `  • USDC: ${usdcBalance.toString()}\n` +
            `  • ${symbol}: ${baseBalance.toString()} (${formatFiat(baseInUsdc.toNumber())} USDC)\n\n` +
            `${symbol} price: $${formatFiat(currentPrice)}\n\n` +
            `Total balance: ${formatFiat(totalBalance.toNumber())} USDC\n\n` +
            `How much USDC do you want to invest?\n\n` +
            `Minimum: ${WIZARD_CONFIG.MIN_INVESTMENT} USDC per order\n\n` +
            `${EMOJI.BULB} Suggested max: ~${suggestedMax} USDC (for ${levels} levels, neutral mode)\n` +
            `  (~${Math.floor(suggestedMax / 2)} USDC + ~${(suggestedMax / 2 / currentPrice).toFixed(4)} ${symbol})`;
    }

    static create(params?: InvestmentPromptParams): AdvancedInvestmentPromptMessage {
        return new AdvancedInvestmentPromptMessage(params);
    }
}
