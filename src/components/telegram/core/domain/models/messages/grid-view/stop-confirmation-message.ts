import { EMOJI } from '../../constants/emoji';
import { PriceFormatter } from '../../formatters/price.formatter';

interface StopConfirmationParams {
    symbol: string;
    id: string;
    lowerPrice: number;
    upperPrice: number;
}

export class StopConfirmationMessage {
    readonly text: string;

    private constructor({ symbol, id, lowerPrice, upperPrice }: StopConfirmationParams) {
        const pair = `${symbol}/USDC`;
        const shortId = id.slice(0, 8);
        const lower = PriceFormatter.format(lowerPrice);
        const upper = PriceFormatter.format(upperPrice);

        this.text =
            `${EMOJI.WARNING} <b>Stop grid?</b>\n\n` +
            `<b>${pair}</b> · Grid (<code>${shortId}</code>)\n` +
            `<b>Range:</b> $${lower} – $${upper}\n\n` +
            `All open orders will be cancelled.`;
    }

    static create(params: StopConfirmationParams): StopConfirmationMessage {
        return new StopConfirmationMessage(params);
    }
}
