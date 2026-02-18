import { Grid } from '@domain/models/grid/grid';
import { GridStatus } from '@domain/models/grid/grid-status';
import { Timestamp } from '@domain/models/primitives/timestamp';
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

export interface GridCardData {
    grid: Grid;
    pnl: number;
    currentPrice: number;
    profitableTrades: number;
}

export class GridListItemMessage {
    static fromCardData({ grid, pnl, currentPrice, profitableTrades }: GridCardData): string {
        const pair = `${grid.symbol.toString()}/USDC`;
        const shortId = grid.id.toString().slice(0, 8);

        const emoji = STATUS_EMOJI[grid.status] ?? EMOJI.WARNING;
        const label = STATUS_LABEL[grid.status] ?? grid.status;
        const duration = grid.startedAt
            ? ` · ${GridListItemMessage.formatDuration(grid.startedAt)}`
            : '';

        const investment = PriceFormatter.format(grid.investmentUSDC.toNumber());
        const pnlStr = GridListItemMessage.formatPnl(pnl);
        const pnlPct = GridListItemMessage.formatPnlPercent(pnl, grid.investmentUSDC.toNumber());
        const lower = PriceFormatter.format(grid.lowerPrice.toNumber());
        const upper = PriceFormatter.format(grid.upperPrice.toNumber());
        const price = PriceFormatter.format(currentPrice);

        return (
            `<b>${pair}</b> · Grid (<code>${shortId}</code>)\n` +
            `${emoji} ${label}${duration}\n` +
            `\n` +
            `<b>Investment (USDC):</b> $${investment}\n` +
            `<b>P&L (USDC):</b> ${pnlStr} (${pnlPct})\n` +
            `<b>Current Price:</b> $${price}\n` +
            `<b>Price Range:</b> $${lower} – $${upper}\n` +
            `<b>Profitable Trades:</b> ${profitableTrades}`
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
