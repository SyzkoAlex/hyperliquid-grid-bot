import { EMOJI } from '../../constants/emoji';
import { PriceFormatter } from '../../formatters/price.formatter';

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
        } = params;
        const currentPriceText = currentPrice
            ? `${EMOJI.DIAMOND} Current Price: ${PriceFormatter.format(currentPrice)}\n`
            : '';
        const stopLossText =
            stopLossEnabled && stopLossPrice !== undefined
                ? `${EMOJI.DIAMOND} Stop-Loss: ${PriceFormatter.format(stopLossPrice)}\n`
                : `${EMOJI.DIAMOND} Stop-Loss: off\n`;

        this.text =
            `<b>${EMOJI.CLIPBOARD} Grid Configuration Preview</b>\n\n` +
            `${EMOJI.DIAMOND} Symbol: ${symbol}\n` +
            `${EMOJI.DIAMOND} Price Range: ${PriceFormatter.format(lowerPrice)} - ${PriceFormatter.format(upperPrice)}\n` +
            currentPriceText +
            `${EMOJI.DIAMOND} Levels: ${levels}\n` +
            `${EMOJI.DIAMOND} Investment: ${totalInvestment} USDC\n` +
            `${EMOJI.DIAMOND} Order Size: ~${orderSize} USDC per level\n` +
            stopLossText +
            `\nReady to create grid?`;
    }

    static create(params: AdvancedPreviewParams): AdvancedPreviewMessage {
        return new AdvancedPreviewMessage(params);
    }
}
