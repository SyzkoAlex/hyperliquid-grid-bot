import { EMOJI } from '../../constants/emoji';
import { PriceFormatter } from '../../formatters/price.formatter';
import { GridFeeMetrics } from '../../grid-fee-calculator';

interface AdvancedPreviewParams {
    symbol: string;
    lowerPrice: number;
    upperPrice: number;
    currentPrice: number | null;
    levels: number;
    totalInvestment: number;
    orderSize: string;
    stopLossEnabled?: boolean;
    stopLossPrice?: number;
    feeMetrics?: GridFeeMetrics;
}

export class AdvancedPreviewMessage {
    readonly text: string;

    private constructor(params: AdvancedPreviewParams) {
        const {
            symbol,
            lowerPrice,
            upperPrice,
            currentPrice,
            levels,
            totalInvestment,
            orderSize,
            stopLossEnabled,
            stopLossPrice,
            feeMetrics,
        } = params;
        const currentPriceText = currentPrice
            ? `${EMOJI.DIAMOND} Current Price: ${PriceFormatter.format(currentPrice)}\n`
            : '';
        const stopLossText =
            stopLossEnabled && stopLossPrice !== undefined
                ? `${EMOJI.DIAMOND} Stop-Loss: ${PriceFormatter.format(stopLossPrice)}\n`
                : `${EMOJI.DIAMOND} Stop-Loss: off\n`;

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

        this.text =
            `<b>${EMOJI.CLIPBOARD} Grid Configuration Preview</b>\n\n` +
            `${EMOJI.DIAMOND} Symbol: ${symbol}\n` +
            `${EMOJI.DIAMOND} Price Range: ${PriceFormatter.format(lowerPrice)} - ${PriceFormatter.format(upperPrice)}\n` +
            currentPriceText +
            `${EMOJI.DIAMOND} Levels: ${levels}\n` +
            `${EMOJI.DIAMOND} Investment: ${totalInvestment} USDC\n` +
            `${EMOJI.DIAMOND} Order Size: ~${orderSize} USDC per level\n` +
            stopLossText +
            (feeText ? `\n${feeText}` : '') +
            `\nReady to create grid?`;
    }

    static create(params: AdvancedPreviewParams): AdvancedPreviewMessage {
        return new AdvancedPreviewMessage(params);
    }
}
