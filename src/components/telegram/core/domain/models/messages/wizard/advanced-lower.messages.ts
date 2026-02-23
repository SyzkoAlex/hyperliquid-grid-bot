import { EMOJI } from '../../constants/emoji.constants';
import { PriceFormatter } from '../../formatters/price.formatter';

export class AdvancedLowerMessages {
    static prompt(upperPrice?: number): string {
        let message = 'Enter lower price for the grid:';

        if (upperPrice !== undefined) {
            message += `\n\nUpper price: ${PriceFormatter.format(upperPrice)}`;
        }

        return message;
    }

    static confirmation(price: number): string {
        return `${EMOJI.SUCCESS} Lower price set: ${PriceFormatter.format(price)}`;
    }
}
