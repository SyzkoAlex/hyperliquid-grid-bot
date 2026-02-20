import { Grid } from '@domain/models/grid/grid';
import { GridStatus } from '@domain/models/grid/grid-status';
import { Order } from '@domain/models/order/order';
import { OrderSide } from '@domain/models/order/order-side';
import { Timestamp } from '@domain/models/primitives/timestamp';
import { PriceFormatter } from '../formatters/price.formatter';
import { EMOJI } from '../constants/emoji.constants';
import {
    GridPnl,
    OrderStats,
} from '@components/telegram/application/use-cases/get-grids-with-pnl/grid-with-pnl';

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

const ORDER_SIDE_EMOJI: Record<string, string> = {
    [OrderSide.Buy]: '▼',
    [OrderSide.Sell]: '▲',
};

const HISTORY_DISPLAY_LIMIT = 30;

export interface GridCardData {
    grid: Grid;
    pnl: GridPnl;
    currentPrice: number;
    orderStats: OrderStats;
    orders: Order[];
}

export class GridListItemMessage {
    /** Compact card shown in /grids list */
    static fromCardData({ grid, pnl, currentPrice, orderStats }: GridCardData): string {
        const pair = `${grid.symbol.toString()}/USDC`;
        const shortId = grid.id.toString().slice(0, 8);

        const emoji = STATUS_EMOJI[grid.status] ?? EMOJI.WARNING;
        const label = STATUS_LABEL[grid.status] ?? grid.status;
        const duration = grid.startedAt
            ? ` · ${GridListItemMessage.formatDuration(grid.startedAt)}`
            : '';

        const totalPnl = pnl.gridProfit + pnl.unrealizedPnl;
        const investment = grid.investmentUSDC.toNumber();
        const pnlStr = GridListItemMessage.formatPnl(totalPnl);
        const pnlPct = GridListItemMessage.formatPnlPercent(totalPnl, investment);
        const lower = PriceFormatter.format(grid.lowerPrice.toNumber());
        const upper = PriceFormatter.format(grid.upperPrice.toNumber());
        const price = PriceFormatter.format(currentPrice);

        return (
            `<b>${pair}</b> · Grid (<code>${shortId}</code>)\n` +
            `${emoji} ${label}${duration}\n` +
            `\n` +
            `<b>P&L (USDC):</b> ${pnlStr} (${pnlPct})\n` +
            `<b>Investment (USDC):</b> $${PriceFormatter.format(investment)}\n` +
            `<b>Price Range:</b> $${lower} – $${upper}\n` +
            `<b>Current Price:</b> $${price}\n` +
            `<b>Profitable Trades:</b> ${orderStats.filledCycles}`
        );
    }

    /** Detail view: main profit/stats view */
    static profitTab({ grid, pnl, currentPrice, orderStats }: GridCardData): string {
        const pair = `${grid.symbol.toString()}/USDC`;
        const emoji = STATUS_EMOJI[grid.status] ?? EMOJI.WARNING;
        const label = STATUS_LABEL[grid.status] ?? grid.status;
        const duration = grid.startedAt
            ? ` · ${GridListItemMessage.formatDuration(grid.startedAt)}`
            : '';

        const totalPnl = pnl.gridProfit + pnl.unrealizedPnl;
        const investment = grid.investmentUSDC.toNumber();
        const totalPnlStr = GridListItemMessage.formatPnl(totalPnl);
        const totalPnlPct = GridListItemMessage.formatPnlPercent(totalPnl, investment);
        const gridProfitStr = GridListItemMessage.formatPnl(pnl.gridProfit);
        const unrealizedStr = GridListItemMessage.formatPnl(pnl.unrealizedPnl);
        const gridApr = GridListItemMessage.formatGridApr(
            pnl.gridProfit,
            investment,
            grid.startedAt,
        );
        const lower = PriceFormatter.format(grid.lowerPrice.toNumber());
        const upper = PriceFormatter.format(grid.upperPrice.toNumber());
        const price = PriceFormatter.format(currentPrice);
        const investmentStr = PriceFormatter.format(investment);
        const startedStr = grid.startedAt
            ? grid.startedAt.toDate().toISOString().slice(0, 16).replace('T', ' ')
            : '—';

        return (
            `<b>${pair}</b> · Spot Grid Bot\n` +
            `${emoji} ${label}${duration}\n` +
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
            `<b>Started:</b> ${startedStr}`
        );
    }

    /** Detail view: active orders list */
    static ordersTab({ grid, currentPrice, orders }: GridCardData): string {
        const pair = `${grid.symbol.toString()}/USDC`;
        const symbol = grid.symbol.toString();
        const emoji = STATUS_EMOJI[grid.status] ?? EMOJI.WARNING;
        const label = STATUS_LABEL[grid.status] ?? grid.status;
        const duration = grid.startedAt
            ? ` · ${GridListItemMessage.formatDuration(grid.startedAt)}`
            : '';

        const active = orders
            .filter((o) => o.isActive())
            .sort((a, b) => (b.price?.toNumber() ?? 0) - (a.price?.toNumber() ?? 0));

        const price = PriceFormatter.format(currentPrice);

        const lines =
            active.length === 0
                ? ['no active orders']
                : active.map((o) => GridListItemMessage.formatOrderLine(o, symbol));

        return (
            `<b>${pair}</b> · Active Orders\n` +
            `${emoji} ${label}${duration}\n` +
            `\n` +
            `${lines.join('\n')}\n` +
            `\n` +
            `<b>Current Price:</b> $${price}`
        );
    }

    /** Detail view: order history (last 30 non-active orders) */
    static historyTab({ grid, orders }: GridCardData): string {
        const pair = `${grid.symbol.toString()}/USDC`;
        const symbol = grid.symbol.toString();
        const emoji = STATUS_EMOJI[grid.status] ?? EMOJI.WARNING;
        const label = STATUS_LABEL[grid.status] ?? grid.status;
        const duration = grid.startedAt
            ? ` · ${GridListItemMessage.formatDuration(grid.startedAt)}`
            : '';

        const filled = orders
            .filter((o) => o.isFilled())
            .sort((a, b) => {
                const tsA = a.filledAt?.toUnixMilliseconds() ?? 0;
                const tsB = b.filledAt?.toUnixMilliseconds() ?? 0;
                return tsB - tsA;
            })
            .slice(0, HISTORY_DISPLAY_LIMIT);

        const lines =
            filled.length === 0
                ? ['no filled orders yet']
                : filled.map((o) => GridListItemMessage.formatOrderLine(o, symbol));

        return (
            `<b>${pair}</b> · Order History\n` +
            `${emoji} ${label}${duration}\n` +
            `\n` +
            `<i>Showing last ${HISTORY_DISPLAY_LIMIT} filled orders</i>\n` +
            `\n` +
            `${lines.join('\n')}`
        );
    }

    private static formatOrderLine(order: Order, symbol: string): string {
        const sideEmoji = ORDER_SIDE_EMOJI[order.side] ?? '·';
        const side = order.side === OrderSide.Buy ? 'Buy ' : 'Sell';
        const p = order.price ? `$${PriceFormatter.format(order.price.toNumber())}` : '—';
        const amt = order.amount.toNumber();
        return `${sideEmoji} ${side}  Lv.${order.levelIndex + 1}  ${p} · ${amt} ${symbol}`;
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

    private static formatGridApr(
        gridProfit: number,
        investment: number,
        startedAt: Timestamp | null,
    ): string {
        if (investment === 0 || !startedAt) return '—';
        const runningHours = Timestamp.now().differenceInHours(startedAt);
        if (runningHours < 1) return '—';
        const runningDays = runningHours / 24;
        const apr = (gridProfit / investment / runningDays) * 365 * 100;
        const sign = apr >= 0 ? '+' : '';
        return `${sign}${apr.toFixed(1)}%`;
    }
}
