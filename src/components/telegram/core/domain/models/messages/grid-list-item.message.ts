import { GridDto } from '@/components/grids/api/dto/grid.dto';
import { OrderDto } from '@/components/grids/api/dto/order.dto';
import { GridStatus } from '@domain/models/grid/grid-status';
import { OrderSide } from '@domain/models/order/order-side';
import { OrderStatus } from '@domain/models/order/order-status';
import { PriceFormatter } from '../formatters/price.formatter';
import { EMOJI } from '../constants/emoji.constants';
import { GridPnl, OrderStats } from '@components/telegram/core/domain/models/grid-with-pnl';

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
    grid: GridDto;
    pnl: GridPnl;
    currentPrice: number;
    orderStats: OrderStats;
    orders: OrderDto[];
}

export class GridListItemMessage {
    /** Compact card shown in /grids list */
    static fromCardData({ grid, pnl, currentPrice, orderStats }: GridCardData): string {
        const pair = `${grid.symbol}/USDC`;
        const shortId = grid.id.slice(0, 8);

        const emoji = STATUS_EMOJI[grid.status] ?? EMOJI.WARNING;
        const label = STATUS_LABEL[grid.status] ?? grid.status;
        const duration = grid.startedAt
            ? ` · ${GridListItemMessage.formatDuration(grid.startedAt)}`
            : '';

        const totalPnl = pnl.gridProfit + pnl.unrealizedPnl;
        const investment = grid.investmentUSDC;
        const pnlStr = GridListItemMessage.formatPnl(totalPnl);
        const pnlPct = GridListItemMessage.formatPnlPercent(totalPnl, investment);
        const lower = PriceFormatter.format(grid.lowerPrice);
        const upper = PriceFormatter.format(grid.upperPrice);
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
        const pair = `${grid.symbol}/USDC`;
        const emoji = STATUS_EMOJI[grid.status] ?? EMOJI.WARNING;
        const label = STATUS_LABEL[grid.status] ?? grid.status;
        const duration = grid.startedAt
            ? ` · ${GridListItemMessage.formatDuration(grid.startedAt)}`
            : '';

        const totalPnl = pnl.gridProfit + pnl.unrealizedPnl;
        const investment = grid.investmentUSDC;
        const totalPnlStr = GridListItemMessage.formatPnl(totalPnl);
        const totalPnlPct = GridListItemMessage.formatPnlPercent(totalPnl, investment);
        const gridProfitStr = GridListItemMessage.formatPnl(pnl.gridProfit);
        const unrealizedStr = GridListItemMessage.formatPnl(pnl.unrealizedPnl);
        const gridApr = GridListItemMessage.formatGridApr(
            pnl.gridProfit,
            investment,
            grid.startedAt,
        );
        const lower = PriceFormatter.format(grid.lowerPrice);
        const upper = PriceFormatter.format(grid.upperPrice);
        const price = PriceFormatter.format(currentPrice);
        const investmentStr = PriceFormatter.format(investment);
        const startedStr = grid.startedAt
            ? new Date(grid.startedAt).toISOString().slice(0, 16).replace('T', ' ')
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
        const pair = `${grid.symbol}/USDC`;
        const symbol = grid.symbol;
        const emoji = STATUS_EMOJI[grid.status] ?? EMOJI.WARNING;
        const label = STATUS_LABEL[grid.status] ?? grid.status;
        const duration = grid.startedAt
            ? ` · ${GridListItemMessage.formatDuration(grid.startedAt)}`
            : '';

        const active = orders
            .filter((o) => o.status === OrderStatus.Placed || o.status === OrderStatus.Pending)
            .sort((a, b) => (b.price ?? 0) - (a.price ?? 0));

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
        const pair = `${grid.symbol}/USDC`;
        const symbol = grid.symbol;
        const emoji = STATUS_EMOJI[grid.status] ?? EMOJI.WARNING;
        const label = STATUS_LABEL[grid.status] ?? grid.status;
        const duration = grid.startedAt
            ? ` · ${GridListItemMessage.formatDuration(grid.startedAt)}`
            : '';

        const filled = orders
            .filter((o) => o.status === OrderStatus.Filled)
            .sort((a, b) => (b.filledAt ?? 0) - (a.filledAt ?? 0))
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

    private static formatOrderLine(order: OrderDto, symbol: string): string {
        const sideEmoji = ORDER_SIDE_EMOJI[order.side] ?? '·';
        const side = order.side === OrderSide.Buy ? 'Buy ' : 'Sell';
        const p = order.price !== null ? `$${PriceFormatter.format(order.price)}` : '—';
        const amt = order.amount;
        return `${sideEmoji} ${side}  Lv.${order.levelIndex + 1}  ${p} · ${amt} ${symbol}`;
    }

    private static formatDuration(startedAtMs: number): string {
        const diff = Date.now() - startedAtMs;
        const minutes = Math.floor(diff / 60000) % 60;
        const hours = Math.floor(diff / 3600000) % 24;
        const days = Math.floor(diff / 86400000);

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
        startedAtMs: number | undefined,
    ): string {
        if (investment === 0 || !startedAtMs) return '—';
        const runningMs = Date.now() - startedAtMs;
        const runningHours = runningMs / 3600000;
        if (runningHours < 1) return '—';
        const runningDays = runningHours / 24;
        const apr = (gridProfit / investment / runningDays) * 365 * 100;
        const sign = apr >= 0 ? '+' : '';
        return `${sign}${apr.toFixed(1)}%`;
    }
}
