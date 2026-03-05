import { EMOJI } from '../../constants/emoji';
import { PriceFormatter } from '../../formatters/price.formatter';

export class ConfirmMessages {
    static creating(
        symbol: string,
        lowerPrice: number,
        upperPrice: number,
        levels: number,
        totalInvestment: number | undefined,
    ): string {
        return (
            `${EMOJI.HOURGLASS} <b>Creating grid...</b>\n\n` +
            `<b>Symbol:</b> ${symbol}\n` +
            `<b>Range:</b> $${PriceFormatter.format(lowerPrice)} – $${PriceFormatter.format(upperPrice)}\n` +
            `<b>Levels:</b> ${levels}\n` +
            `<b>Investment:</b> ${totalInvestment} USDC\n\n` +
            `We'll notify you when the grid is ready.`
        );
    }
}
