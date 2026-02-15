import { EMOJI } from '../../constants/emoji.constants';

export class AdvancedPreviewMessages {
    static preview(
        symbol: string,
        mode: string,
        lowerPrice: number,
        upperPrice: number,
        currentPrice: number | null,
        levels: number,
        totalInvestment: number,
        orderSize: string,
    ): string {
        const currentPriceText = currentPrice
            ? `${EMOJI.DIAMOND} Current Price: ${currentPrice.toFixed(2)}\n`
            : '';

        return (
            `<b>${EMOJI.CLIPBOARD} Grid Configuration Preview</b>\n\n` +
            `${EMOJI.DIAMOND} Symbol: ${symbol}\n` +
            `${EMOJI.DIAMOND} Mode: ${mode}\n` +
            `${EMOJI.DIAMOND} Price Range: ${lowerPrice.toFixed(4)} - ${upperPrice.toFixed(4)}\n` +
            currentPriceText +
            `${EMOJI.DIAMOND} Levels: ${levels}\n` +
            `${EMOJI.DIAMOND} Investment: ${totalInvestment} USDC\n` +
            `${EMOJI.DIAMOND} Order Size: ~${orderSize} USDC per level\n\n` +
            `Ready to create grid?`
        );
    }
}
