import { GridStatus } from '@domain/models/grid/grid-status';
import { Timestamp } from '@domain/models/primitives/timestamp';
import { GridWithPnl } from '@components/telegram/application/use-cases/get-grids-with-pnl/grid-with-pnl';
import { PriceFormatter } from '../formatters/price.formatter';
import { EMOJI } from '../constants/emoji.constants';

const STATUS_EMOJI: Record<GridStatus, string> = {
    [GridStatus.Running]: EMOJI.GREEN_CIRCLE,
    [GridStatus.Stopped]: EMOJI.RED_CIRCLE,
    [GridStatus.Paused]: '⏸',
    [GridStatus.Idle]: '🔵',
    [GridStatus.Error]: EMOJI.WARNING,
};

const STATUS_LABEL: Record<GridStatus, string> = {
    [GridStatus.Running]: 'Active',
    [GridStatus.Stopped]: 'Stopped',
    [GridStatus.Paused]: 'Paused',
    [GridStatus.Idle]: 'Idle',
    [GridStatus.Error]: 'Error',
};

export class GridsListMessages {
    static list(items: GridWithPnl[]): string {
        if (items.length === 0) {
            return `<b>${EMOJI.CLIPBOARD} My Grids</b>\n\nNo grids found. Create your first grid!`;
        }

        const cards = items.map((item) => GridsListMessages.card(item));
        return `<b>${EMOJI.CLIPBOARD} My Grids</b> (${items.length})\n\n${cards.join('\n\n')}`;
    }

    static card({ grid, pnl, currentPrice, profitableTrades }: GridWithPnl): string {
        const pair = `${grid.symbol.toString()}/USDC`;
        const shortId = grid.id.toString().slice(0, 8);

        const emoji = STATUS_EMOJI[grid.status] ?? EMOJI.WARNING;
        const label = STATUS_LABEL[grid.status] ?? grid.status;
        const duration = grid.startedAt
            ? ` · ${GridsListMessages.formatDuration(grid.startedAt)}`
            : '';

        const investment = PriceFormatter.format(grid.investmentUSDC.toNumber());
        const pnlStr = GridsListMessages.formatPnl(pnl);
        const pnlPct = GridsListMessages.formatPnlPercent(pnl, grid.investmentUSDC.toNumber());
        const lower = PriceFormatter.format(grid.lowerPrice.toNumber());
        const upper = PriceFormatter.format(grid.upperPrice.toNumber());
        const price = PriceFormatter.format(currentPrice);

        return (
            `<b>${pair}</b> · Grid (<code>${shortId}</code>)\n` +
            `${emoji} ${label}${duration}\n` +
            `\n` +
            `Investment (USDC): $${investment}\n` +
            `P&L (USDC): ${pnlStr} (${pnlPct})\n` +
            `Current Price: $${price}\n` +
            `Price Range: $${lower} – $${upper}\n` +
            `Profitable Trades: ${profitableTrades}`
        );
    }

    private static formatDuration(startedAt: Timestamp): string {
        const now = Timestamp.now();
        const days = now.differenceInDays(startedAt);
        const hours = now.differenceInHours(startedAt) % 24;
        const minutes = now.differenceInMinutes(startedAt) % 60;

        if (days > 0) return `${days}D ${hours}h ${minutes}m`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    }

    private static formatPnl(pnl: number): string {
        const sign = pnl >= 0 ? '+' : '-';
        return `${sign}$${PriceFormatter.format(Math.abs(pnl))}`;
    }

    private static formatPnlPercent(pnl: number, investment: number): string {
        if (investment === 0) return '0.00%';
        const pct = (pnl / investment) * 100;
        const sign = pct >= 0 ? '+' : '';
        return `${sign}${pct.toFixed(2)}%`;
    }
}
