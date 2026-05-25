import { EMOJI } from '../../constants/emoji';
import { WIZARD_CONFIG } from '../../constants/wizard-config';
import { Decimal } from '@domain/models/primitives/decimal';
import { formatFiat } from '../../formatters/format-fiat';
import { FEE_HINT_LINE } from './fee-hint';

interface QuickStartPromptParams {
    symbol: string;
    usdcBalance: Decimal;
    baseBalance: Decimal;
    baseInUsdc: Decimal;
    totalBalance: Decimal;
    currentPrice: number;
    suggestedMax: number;
}

export class QuickStartPromptMessage {
    readonly text: string;

    private constructor(params?: QuickStartPromptParams) {
        if (!params) {
            this.text =
                `How much USDC do you want to invest?\n\n` +
                `Minimum: ${WIZARD_CONFIG.MIN_INVESTMENT} USDC per order\n\n` +
                FEE_HINT_LINE;
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
        } = params;
        this.text =
            `${EMOJI.MONEY} Your balance:\n` +
            `  • USDC: ${usdcBalance.toString()}\n` +
            `  • ${symbol}: ${baseBalance.toString()} (${formatFiat(baseInUsdc.toNumber())} USDC)\n\n` +
            `${symbol} price: $${formatFiat(currentPrice)}\n\n` +
            `Total balance: ${formatFiat(totalBalance.toNumber())} USDC\n\n` +
            `How much USDC do you want to invest?\n\n` +
            `Minimum: ${WIZARD_CONFIG.MIN_INVESTMENT} USDC per order\n\n` +
            `${EMOJI.BULB} Suggested max: ~${suggestedMax} USDC (for ${WIZARD_CONFIG.DEFAULT_LEVELS} levels)\n` +
            `  (~${Math.floor(suggestedMax / 2)} USDC + ~${(suggestedMax / 2 / currentPrice).toFixed(4)} ${symbol})\n\n` +
            FEE_HINT_LINE;
    }

    static create(params?: QuickStartPromptParams): QuickStartPromptMessage {
        return new QuickStartPromptMessage(params);
    }
}
