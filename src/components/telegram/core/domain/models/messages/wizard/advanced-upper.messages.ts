import { EMOJI } from '../../constants/emoji';
import { PriceFormatter } from '../../formatters/price.formatter';

export class AdvancedUpperPromptMessage {
    readonly text: string;

    private constructor(symbol?: string, currentPrice?: number) {
        let message = 'Enter upper price for the grid:';

        if (symbol && currentPrice !== undefined) {
            message += `\n\nCurrent ${symbol} price: ${PriceFormatter.format(currentPrice)}`;
        } else if (symbol) {
            message += `\n\n${EMOJI.WARNING} Could not fetch current price`;
        }

        this.text = message;
    }

    static create(symbol?: string, currentPrice?: number): AdvancedUpperPromptMessage {
        return new AdvancedUpperPromptMessage(symbol, currentPrice);
    }
}
