import { EMOJI } from '../../constants/emoji';
import { calculateGridFeeMetrics } from '../../grid-fee-calculator';
import { feeHintLine } from './fee-hint';
import { formatFiat } from '../../formatters/format-fiat';

interface AdvancedPreviewParams {
    totalInvestment: number;
    orderCount: number;
    lowerPrice: number;
    upperPrice: number;
    capacityMax?: number;
}

export class AdvancedPreviewMessage {
    readonly text: string;

    private constructor({
        totalInvestment,
        orderCount,
        lowerPrice,
        upperPrice,
        capacityMax,
    }: AdvancedPreviewParams) {
        const metrics = calculateGridFeeMetrics({
            lowerPrice,
            upperPrice,
            orderCount,
            totalInvestment,
        });
        const hint = feeHintLine({ totalInvestment, orderCount, lowerPrice, upperPrice });

        const breakEvenLine = !metrics.isProfitable
            ? `\n${EMOJI.WARNING} Break-even risk: grid step (${metrics.gridStepPct.toFixed(4)}%) < 2× fee rate`
            : '';

        const capacityLine =
            capacityMax && capacityMax > 0
                ? `${EMOJI.MONEY} $${formatFiat(totalInvestment)} of $${formatFiat(capacityMax)}` +
                  ` max for this grid (${Math.round((totalInvestment / capacityMax) * 100)}%)\n`
                : '';

        this.text = `${capacityLine}${hint}${breakEvenLine}\n\nReady to create grid?`;
    }

    static create(params: AdvancedPreviewParams): AdvancedPreviewMessage {
        return new AdvancedPreviewMessage(params);
    }
}
