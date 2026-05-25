import { EMOJI } from '../../constants/emoji';
import { Decimal } from '@domain/models/primitives/decimal';
import { feeHintLine } from './fee-hint';

interface InvestmentPromptParams {
    symbol: string;
    usdcBalance: Decimal;
    baseBalance: Decimal;
    baseInUsdc: Decimal;
    totalBalance: Decimal;
    currentPrice: number;
    suggestedMax: number;
    levels: number;
    lowerPrice: number;
    upperPrice: number;
}

export class AdvancedInvestmentPromptMessage {
    readonly text: string;

    private constructor(params?: InvestmentPromptParams) {
        if (!params) {
            this.text = `How much to invest?\n\n` + feeHintLine();
            return;
        }

        const {
            symbol,
            usdcBalance,
            baseBalance,
            totalBalance,
            suggestedMax,
            levels,
            lowerPrice,
            upperPrice,
        } = params;

        const feeHint = feeHintLine({ suggestedMax, levels, lowerPrice, upperPrice });

        const totalRounded = Math.round(totalBalance.toNumber()).toLocaleString('en-US');
        const usdcRounded = Math.round(usdcBalance.toNumber()).toLocaleString('en-US');
        const baseFormatted = parseFloat(baseBalance.toNumber().toFixed(2)).toLocaleString('en-US');

        this.text =
            `How much to invest?\n\n` +
            `${EMOJI.MONEY} Available: ~${totalRounded} USDC\n` +
            `   (${usdcRounded} USDC + ${baseFormatted} ${symbol})\n\n` +
            `${EMOJI.BULB} Recommended: ~${suggestedMax} USDC for ${levels} levels\n` +
            feeHint;
    }

    static create(params?: InvestmentPromptParams): AdvancedInvestmentPromptMessage {
        return new AdvancedInvestmentPromptMessage(params);
    }
}
