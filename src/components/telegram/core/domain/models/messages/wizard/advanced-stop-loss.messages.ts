import { EMOJI } from '../../constants/emoji';
import { PriceFormatter } from '../../formatters/price.formatter';

export class AdvancedStopLossPromptMessage {
    readonly text: string;

    private constructor(lowerPrice?: number) {
        const lowerText = lowerPrice ? ` (lower bound: ${PriceFormatter.format(lowerPrice)})` : '';
        this.text =
            `${EMOJI.WARNING} <b>Stop-Loss (optional)</b>\n\n` +
            `Stop-loss will automatically cancel all orders and sell your base tokens if the ` +
            `market price falls and stays below your stop-loss price.\n\n` +
            `Your stop-loss must be at least 0.5% below your lower bound${lowerText}.\n\n` +
            `Tap <b>Skip (No SL)</b> to disable, or send a price:`;
    }

    static create(lowerPrice?: number): AdvancedStopLossPromptMessage {
        return new AdvancedStopLossPromptMessage(lowerPrice);
    }
}

export class AdvancedStopLossConfirmationMessage {
    readonly text: string;

    private constructor(price: number) {
        this.text = `${EMOJI.WARNING} Stop-Loss: ${PriceFormatter.format(price)}`;
    }

    static create(price: number): AdvancedStopLossConfirmationMessage {
        return new AdvancedStopLossConfirmationMessage(price);
    }
}
