import { EMOJI } from '../../constants/emoji';
import { PriceFormatter } from '../../formatters/price.formatter';

interface GridCreatingParams {
    symbol: string;
    lowerPrice: number;
    upperPrice: number;
    levels: number;
    totalInvestment: number | undefined;
}

export class GridCreatingMessage {
    readonly text: string;

    private constructor(params: GridCreatingParams) {
        const { symbol, lowerPrice, upperPrice, levels, totalInvestment } = params;
        this.text =
            `${EMOJI.HOURGLASS} <b>Creating grid...</b>\n\n` +
            `<b>Symbol:</b> ${symbol}\n` +
            `<b>Range:</b> $${PriceFormatter.format(lowerPrice)} – $${PriceFormatter.format(upperPrice)}\n` +
            `<b>Levels:</b> ${levels}\n` +
            `<b>Investment:</b> ${totalInvestment} USDC\n\n` +
            `We'll notify you when the grid is ready.`;
    }

    static create(params: GridCreatingParams): GridCreatingMessage {
        return new GridCreatingMessage(params);
    }
}
