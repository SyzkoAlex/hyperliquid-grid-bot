import { EMOJI } from '../../constants/emoji.constants';

export class AdvancedLowerMessages {
    static prompt(upperPrice?: number): string {
        let message = 'Enter lower price for the grid:';

        if (upperPrice !== undefined) {
            message += `\n\nUpper price: ${upperPrice.toFixed(4)}`;
        }

        return message;
    }

    static confirmation(price: number): string {
        return `${EMOJI.SUCCESS} Lower price set: ${price.toFixed(4)}`;
    }
}
