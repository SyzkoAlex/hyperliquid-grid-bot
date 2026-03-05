import { EMOJI } from '../constants/emoji';
import { PriceFormatter } from '../formatters/price.formatter';

export class GridViewMessages {
    static readonly NOT_FOUND = `${EMOJI.WARNING} Grid not found.`;
    static readonly LOAD_ERROR = `${EMOJI.ERROR} Failed to load grid data.`;
    static readonly STOPPED_SUCCESS = `${EMOJI.SUCCESS} Grid stopped successfully.`;
    static readonly STOPPED_ERROR = `${EMOJI.ERROR} Failed to stop grid. Please try again.`;
    static readonly STOPPING = `${EMOJI.HOURGLASS} <b>Stopping grid...</b>\n\nCancelling open orders, please wait.`;

    static stopConfirmation(
        symbol: string,
        id: string,
        lowerPrice: number,
        upperPrice: number,
    ): string {
        const pair = `${symbol}/USDC`;
        const shortId = id.slice(0, 8);
        const lower = PriceFormatter.format(lowerPrice);
        const upper = PriceFormatter.format(upperPrice);

        return (
            `${EMOJI.WARNING} <b>Stop grid?</b>\n\n` +
            `<b>${pair}</b> · Grid (<code>${shortId}</code>)\n` +
            `<b>Range:</b> $${lower} – $${upper}\n\n` +
            `All open orders will be cancelled.`
        );
    }
}
