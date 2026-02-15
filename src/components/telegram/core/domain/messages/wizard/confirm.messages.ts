import { EMOJI } from '../../constants/emoji.constants';
import { PriceFormatter } from '../../formatters/price.formatter';

export class ConfirmMessages {
    static success(
        symbol: string,
        lowerPrice: number,
        upperPrice: number,
        levels: number,
        totalInvestment: number | undefined,
    ): string {
        return (
            `${EMOJI.SUCCESS} <b>Grid creation started!</b>\n\n` +
            `Symbol: ${symbol}\n` +
            `Price Range: ${PriceFormatter.format(lowerPrice)} - ${PriceFormatter.format(upperPrice)}\n` +
            `Levels: ${levels}\n` +
            `Investment: ${totalInvestment} USDC\n\n` +
            `You'll receive notifications when orders are placed.`
        );
    }
}
