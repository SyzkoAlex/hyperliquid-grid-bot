import { PriceFormatter } from '@components/telegram/core/domain/models/formatters/price.formatter';
import { GridSnapshot } from '@components/telegram/core/domain/models/grid-snapshot';
import { formatOrderLine } from '@components/telegram/core/domain/models/formatters/format-order-line';
import { gridHeaderParts } from './grid-message.helpers';

const HISTORY_DISPLAY_LIMIT = 30;

export class GridHistoryTabMessage {
    readonly text: string;

    private constructor({ grid, filledOrders, currentPrice }: GridSnapshot) {
        const { pair, shortId } = gridHeaderParts(grid);
        const symbol = grid.symbol;

        const filled = filledOrders.slice(0, HISTORY_DISPLAY_LIMIT);

        const lines =
            filled.length === 0
                ? ['no filled orders yet']
                : filled.map((o) => formatOrderLine(o, symbol));

        const limitNote =
            filled.length > 0 ? `\n<i>Showing last ${filled.length} filled orders</i>\n` : '';

        this.text =
            `<b>${pair}</b> · Grid (<code>${shortId}</code>)\n` +
            `<b>Order History (${filled.length})</b>\n` +
            `<b>Current Price:</b> $${PriceFormatter.format(currentPrice)}\n` +
            limitNote +
            `\n` +
            `${lines.join('\n')}\n`;
    }

    static create(snapshot: GridSnapshot): GridHistoryTabMessage {
        return new GridHistoryTabMessage(snapshot);
    }
}
