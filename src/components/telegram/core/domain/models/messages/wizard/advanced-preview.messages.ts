import { EMOJI } from '../../constants/emoji';
import { calculateGridFeeMetrics } from '../../grid-fee-calculator';
import { feeHintLine } from './fee-hint';

interface AdvancedPreviewParams {
    totalInvestment: number;
    orderCount: number;
    lowerPrice: number;
    upperPrice: number;
}

export class AdvancedPreviewMessage {
    readonly text: string;

    private constructor({
        totalInvestment,
        orderCount,
        lowerPrice,
        upperPrice,
    }: AdvancedPreviewParams) {
        const metrics = calculateGridFeeMetrics({
            lowerPrice,
            upperPrice,
            orderCount,
            totalInvestment,
        });
        const hint = feeHintLine({
            suggestedMax: totalInvestment,
            orderCount,
            lowerPrice,
            upperPrice,
        });

        const breakEvenLine = !metrics.isProfitable
            ? `\n${EMOJI.WARNING} Break-even risk: grid step (${metrics.gridStepPct.toFixed(4)}%) < 2× fee rate`
            : '';

        this.text = `${hint}${breakEvenLine}\n\nReady to create grid?`;
    }

    static create(params: AdvancedPreviewParams): AdvancedPreviewMessage {
        return new AdvancedPreviewMessage(params);
    }
}
