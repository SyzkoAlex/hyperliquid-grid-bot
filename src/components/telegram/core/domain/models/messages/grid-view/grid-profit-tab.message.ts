import { PriceFormatter } from '@components/telegram/core/domain/models/formatters/price.formatter';
import { EMOJI } from '@components/telegram/core/domain/models/constants/emoji';
import { GridSnapshot } from '@components/telegram/core/domain/models/grid-snapshot';
import { GridStatus } from '@domain/models/grid/grid-status';
import {
    formatPnl,
    formatPnlPercent,
} from '@components/telegram/core/domain/models/formatters/format-pnl';
import { formatGridApr } from '@components/telegram/core/domain/models/formatters/format-grid-apr';
import { gridHeaderParts, isGridOutOfRange } from './grid-message.helpers';

export class GridProfitTabMessage {
    readonly text: string;

    private constructor({ grid, pnl, currentPrice, orderStats }: GridSnapshot) {
        const { pair, shortId, emoji, label, duration } = gridHeaderParts(grid);
        const totalPnl = pnl.gridProfit + pnl.unrealizedPnl;
        const investment = grid.investmentUSDC + grid.investmentBase * currentPrice;
        const totalPnlStr = formatPnl(totalPnl);
        const totalPnlPct = formatPnlPercent(totalPnl, investment);
        const gridProfitStr = formatPnl(pnl.gridProfit);
        const unrealizedStr = formatPnl(pnl.unrealizedPnl);
        const gridApr = formatGridApr(pnl.gridProfit, investment, grid.startedAt);
        const lower = PriceFormatter.format(grid.lowerPrice);
        const upper = PriceFormatter.format(grid.upperPrice);
        const price = PriceFormatter.format(currentPrice);
        const investmentStr = PriceFormatter.format(investment);
        const startedStr = grid.startedAt
            ? new Date(grid.startedAt).toISOString().slice(0, 16).replace('T', ' ')
            : '—';

        const outOfRange = isGridOutOfRange(grid, currentPrice);
        const rangeWarning =
            outOfRange && grid.status === GridStatus.Running
                ? `\n${EMOJI.WARNING} <b>Price is out of grid range!</b>\n`
                : '';

        this.text =
            `<b>${pair}</b> · Grid (<code>${shortId}</code>)\n` +
            `${emoji} ${label}${duration}\n` +
            rangeWarning +
            `\n` +
            `<b>Total PnL:</b>    ${totalPnlStr} (${totalPnlPct})\n` +
            `<b>Grid Profit:</b>  ${gridProfitStr}\n` +
            `<b>Grid APR:</b>     ${gridApr}\n` +
            `<b>Unrealized:</b>   ${unrealizedStr}\n` +
            `<b>Profitable Trades:</b> ${orderStats.filledCycles}\n` +
            `\n` +
            `<b>Investment:</b> $${investmentStr}\n` +
            `<b>Range:</b> $${lower} – $${upper} · ${grid.levels} levels\n` +
            `<b>Current Price:</b> $${price}\n` +
            `<b>Started:</b> ${startedStr}\n`;
    }

    static create(snapshot: GridSnapshot): GridProfitTabMessage {
        return new GridProfitTabMessage(snapshot);
    }
}
