import { PriceFormatter } from '@components/telegram/core/domain/models/formatters/price.formatter';
import { EMOJI } from '@components/telegram/core/domain/models/constants/emoji';
import { GridSnapshot } from '@components/telegram/core/domain/models/grid-snapshot';
import { GridStatus } from '@domain/models/grid/grid-status';
import {
    formatPnl,
    formatPnlPercent,
} from '@components/telegram/core/domain/models/formatters/format-pnl';
import { isGridOutOfRange } from '../grid-view/grid-message.helpers';

export class GridListMessage {
    readonly text: string;

    private constructor(header: string, items: GridSnapshot[], startIndex: number) {
        if (items.length === 0) {
            this.text = header;
            return;
        }
        const lines = items.map((item, i) => GridListMessage.compactLine(startIndex + i + 1, item));
        this.text = [header, '', ...lines].join('\n');
    }

    static create(header: string, items: GridSnapshot[], startIndex: number): GridListMessage {
        return new GridListMessage(header, items, startIndex);
    }

    private static compactLine(index: number, { grid, pnl, currentPrice }: GridSnapshot): string {
        const shortId = grid.id.slice(0, 8);
        const totalPnl = pnl.gridProfit + pnl.unrealizedPnl;
        const totalInvestment = grid.investmentUSDC + grid.investmentBase * currentPrice;
        const pnlStr = formatPnl(totalPnl);
        const pnlPct = formatPnlPercent(totalPnl, totalInvestment);
        const lower = PriceFormatter.format(grid.lowerPrice);
        const upper = PriceFormatter.format(grid.upperPrice);
        const price = PriceFormatter.format(currentPrice);
        const outOfRange =
            grid.status === GridStatus.Running && isGridOutOfRange(grid, currentPrice);
        const warn = outOfRange ? ` ${EMOJI.WARNING}` : '';

        return (
            `<b>${index}. ${grid.symbol}/USDC</b> (<code>${shortId}</code>)${warn}\n` +
            `     $${lower} – $${upper} · Price: $${price}\n` +
            `     PnL: ${pnlStr} (${pnlPct}) · $${PriceFormatter.format(totalInvestment)}`
        );
    }
}
