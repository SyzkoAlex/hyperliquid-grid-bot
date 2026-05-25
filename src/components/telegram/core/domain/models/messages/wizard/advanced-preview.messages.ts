import { EMOJI } from '../../constants/emoji';
import { GridFeeMetrics } from '../../grid-fee-calculator';

interface AdvancedPreviewParams {
    totalInvestment: number;
    feeMetrics?: GridFeeMetrics;
}

export class AdvancedPreviewMessage {
    readonly text: string;

    private constructor({ totalInvestment, feeMetrics }: AdvancedPreviewParams) {
        let feeText = '';
        if (feeMetrics) {
            const { feePerCycle, profitPerGridPct, gridStepPct, isProfitable } = feeMetrics;
            feeText =
                `${EMOJI.MONEY_WINGS} Fee per grid cycle: ~${feePerCycle.toFixed(2)} USDC\n` +
                `${EMOJI.CHART_UP} Profit per grid: ${profitPerGridPct.toFixed(4)}%` +
                ` (~${((profitPerGridPct / 100) * totalInvestment).toFixed(2)} USDC/cycle)\n`;
            if (!isProfitable) {
                feeText += `${EMOJI.WARNING} Break-even risk: grid step (${gridStepPct.toFixed(4)}%) < 2× fee rate\n`;
            }
        }

        this.text = (feeText ? `${feeText}\n` : '') + `Ready to create grid?`;
    }

    static create(params: AdvancedPreviewParams): AdvancedPreviewMessage {
        return new AdvancedPreviewMessage(params);
    }
}
