import { EMOJI } from '../../constants/emoji';
import { PriceFormatter } from '../../formatters/price.formatter';

export class AdvancedStopLossConfirmationMessage {
    readonly text: string;

    private constructor(price: number) {
        this.text = `${EMOJI.WARNING} Stop-Loss: ${PriceFormatter.format(price)}`;
    }

    static create(price: number): AdvancedStopLossConfirmationMessage {
        return new AdvancedStopLossConfirmationMessage(price);
    }
}
