import { EMOJI } from '../../constants/emoji';
import { WIZARD_CONFIG } from '../../constants/wizard-config';
import { Decimal } from '@domain/models/primitives/decimal';
import { feeHintLine } from './fee-hint';

interface QuickStartPromptParams {
    symbol: string;
    usdcBalance: Decimal;
    baseBalance: Decimal;
    baseInUsdc: Decimal;
    totalBalance: Decimal;
    currentPrice: number;
    suggestedMax: number;
    lowerPrice: number;
    upperPrice: number;
}

export class QuickStartPromptMessage {
    readonly text: string;

    private constructor(params?: QuickStartPromptParams) {
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
            lowerPrice,
            upperPrice,
        } = params;

        const feeHint = feeHintLine({
            suggestedMax,
            levels: WIZARD_CONFIG.DEFAULT_LEVELS,
            lowerPrice,
            upperPrice,
        });

        const totalRounded = Math.round(totalBalance.toNumber()).toLocaleString('en-US');
        const usdcRounded = Math.round(usdcBalance.toNumber()).toLocaleString('en-US');
        const baseFormatted = parseFloat(baseBalance.toNumber().toFixed(2)).toLocaleString('en-US');

        this.text =
            `How much to invest?\n\n` +
            `${EMOJI.MONEY} Available: ~${totalRounded} USDC\n` +
            `   (${usdcRounded} USDC + ${baseFormatted} ${symbol})\n\n` +
            `${EMOJI.BULB} Recommended: ~${suggestedMax} USDC for ${WIZARD_CONFIG.DEFAULT_LEVELS} levels\n` +
            feeHint;
    }

    static create(params?: QuickStartPromptParams): QuickStartPromptMessage {
        return new QuickStartPromptMessage(params);
    }
}
