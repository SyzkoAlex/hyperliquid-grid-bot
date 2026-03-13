import { PriceFormatter } from '@components/telegram/core/domain/models/formatters/price.formatter';
import { GridSnapshot } from '@components/telegram/core/domain/models/grid-snapshot';
import { formatOrderLine } from '@components/telegram/core/domain/models/formatters/format-order-line';
import { gridHeaderParts } from './grid-message.helpers';

export class GridOrdersTabMessage {
    readonly text: string;

    private constructor({ grid, currentPrice, activeOrders }: GridSnapshot) {
        const { pair, shortId } = gridHeaderParts(grid);
        const symbol = grid.symbol;

        const active = activeOrders.slice().sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
        const price = PriceFormatter.format(currentPrice);

        const lines =
            active.length === 0
                ? ['no active orders']
                : active.map((o) => formatOrderLine(o, symbol));

        this.text =
            `<b>${pair}</b> · Grid (<code>${shortId}</code>)\n` +
            `<b>Active Orders (${active.length})</b>\n` +
            `<b>Current Price:</b> $${price}\n` +
            `\n` +
            `${lines.join('\n')}\n`;
    }

    static create(snapshot: GridSnapshot): GridOrdersTabMessage {
        return new GridOrdersTabMessage(snapshot);
    }
}
