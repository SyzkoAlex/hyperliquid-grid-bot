import { PriceFormatter } from '../../formatters/price.formatter';

export class AdvancedLowerPromptMessage {
    readonly text: string;

    private constructor(upperPrice?: number) {
        let message = 'Enter lower price for the grid:';

        if (upperPrice !== undefined) {
            message += `\n\nUpper price: ${PriceFormatter.format(upperPrice)}`;
        }

        this.text = message;
    }

    static create(upperPrice?: number): AdvancedLowerPromptMessage {
        return new AdvancedLowerPromptMessage(upperPrice);
    }
}
