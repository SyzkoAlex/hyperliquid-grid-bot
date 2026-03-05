import { EMOJI } from '../../constants/emoji';
import { PriceFormatter } from '../../formatters/price.formatter';

export class AdvancedUpperMessages {
    static prompt(symbol?: string, currentPrice?: number): string {
        let message = 'Enter upper price for the grid:';

        if (symbol && currentPrice !== undefined) {
            message += `\n\nCurrent ${symbol} price: ${PriceFormatter.format(currentPrice)}`;
        } else if (symbol) {
            message += `\n\n${EMOJI.WARNING} Could not fetch current price`;
        }

        return message;
    }

    static confirmation(price: number): string {
        return `${EMOJI.SUCCESS} Upper price set: ${PriceFormatter.format(price)}`;
    }
}
