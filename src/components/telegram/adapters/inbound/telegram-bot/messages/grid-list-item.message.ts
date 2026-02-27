import { GridStatus } from '@domain/models/grid/grid-status';
import { OrderSide } from '@domain/models/order/order-side';
import { OrderStatus } from '@domain/models/order/order-status';
import { OrderDto } from '@components/grids/api/dto/order.dto';
import { PriceFormatter } from '../../../../core/domain/models/formatters/price.formatter';
import { EMOJI } from '../../../../core/domain/models/constants/emoji.constants';
import { GridWithPnl } from '../../../../core/application/use-cases/get-grids-with-pnl/grid-with-pnl';

const STATUS_EMOJI: Record<GridStatus, string> = {
    [GridStatus.Running]: EMOJI.GREEN_CIRCLE,
    [GridStatus.Stopped]: EMOJI.RED_CIRCLE,
    [GridStatus.Paused]: EMOJI.PAUSE,
    [GridStatus.Idle]: EMOJI.BLUE_CIRCLE,
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
    [OrderSide.Buy]: EMOJI.ARROW_DOWN,
    [OrderSide.Sell]: EMOJI.ARROW_UP,
};

const HISTORY_DISPLAY_LIMIT = 30;
const SEPARATOR = '━━━━━━━━━━━━━━━━━━';

export class GridListItemMessage {
    /** Full paginated list: header + compact lines */
    static list(header: string, items: GridWithPnl[], startIndex: number): string {
        if (items.length === 0) return header;
        const lines = items.map((item, i) => this.compactLine(startIndex + i + 1, item));
        return [header, '', ...lines].join('\n');
    }

    /** Compact card shown in /grids list */
    static fromCardData({ grid, pnl, currentPrice, orderStats }: GridWithPnl): string {
        const { pair, shortId, emoji, label, duration } = GridListItemMessage.headerParts(grid);
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
            `<b>Profitable Trades:</b> ${orderStats.filledCycles}\n` +
            SEPARATOR
        );
    }

    /** Compact entry for grids list (max 3 lines) */
    static compactLine(index: number, { grid, pnl, currentPrice }: GridWithPnl): string {
        const shortId = grid.id.slice(0, 8);
        const totalPnl = pnl.gridProfit + pnl.unrealizedPnl;
        const pnlStr = GridListItemMessage.formatPnl(totalPnl);
        const pnlPct = GridListItemMessage.formatPnlPercent(totalPnl, grid.investmentUSDC);
        const lower = PriceFormatter.format(grid.lowerPrice);
        const upper = PriceFormatter.format(grid.upperPrice);
        const price = PriceFormatter.format(currentPrice);
        const outOfRange =
            grid.status === GridStatus.Running &&
            GridListItemMessage.isOutOfRange(grid, currentPrice);
        const warn = outOfRange ? ` ${EMOJI.WARNING}` : '';

        return (
            `<b>${index}. ${grid.symbol}/USDC</b> (<code>${shortId}</code>)${warn}\n` +
            `     $${lower} – $${upper} · Price: $${price}\n` +
            `     PnL: ${pnlStr} (${pnlPct}) · $${PriceFormatter.format(grid.investmentUSDC)}`
        );
    }

    /** Detail view: main profit/stats view */
    static profitTab({ grid, pnl, currentPrice, orderStats }: GridWithPnl): string {
        const { pair, shortId, emoji, label, duration } = GridListItemMessage.headerParts(grid);
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

        const outOfRange = GridListItemMessage.isOutOfRange(grid, currentPrice);
        const rangeWarning =
            outOfRange && grid.status === GridStatus.Running
                ? `\n${EMOJI.WARNING} <b>Price is out of grid range!</b>\n`
                : '';

        return (
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
            `<b>Started:</b> ${startedStr}\n` +
            SEPARATOR
        );
    }

    /** Detail view: active orders list */
    static ordersTab({ grid, currentPrice, orders }: GridWithPnl): string {
        const { pair, shortId, emoji, label, duration } = GridListItemMessage.headerParts(grid);
        const symbol = grid.symbol;

        const active = orders
            .filter((o) => o.status === OrderStatus.Placed || o.status === OrderStatus.Pending)
            .sort((a, b) => (b.price ?? 0) - (a.price ?? 0));

        const price = PriceFormatter.format(currentPrice);

        const lines =
            active.length === 0
                ? ['no active orders']
                : active.map((o) => GridListItemMessage.formatOrderLine(o, symbol));

        return (
            `<b>${pair}</b> · Grid (<code>${shortId}</code>)\n` +
            `<b>Active Orders</b>\n` +
            `${emoji} ${label}${duration}\n` +
            `\n` +
            `${lines.join('\n')}\n` +
            `\n` +
            `<b>Current Price:</b> $${price}\n` +
            SEPARATOR
        );
    }

    /** Detail view: order history (last 30 non-active orders) */
    static historyTab({ grid, orders }: GridWithPnl): string {
        const { pair, shortId, emoji, label, duration } = GridListItemMessage.headerParts(grid);
        const symbol = grid.symbol;

        const filled = orders
            .filter((o) => o.status === OrderStatus.Filled)
            .sort((a, b) => (b.filledAt ?? 0) - (a.filledAt ?? 0))
            .slice(0, HISTORY_DISPLAY_LIMIT);

        const lines =
            filled.length === 0
                ? ['no filled orders yet']
                : filled.map((o) => GridListItemMessage.formatOrderLine(o, symbol));

        const limitNote =
            filled.length > 0 ? `\n<i>Showing last ${filled.length} filled orders</i>\n` : '';

        return (
            `<b>${pair}</b> · Grid (<code>${shortId}</code>)\n` +
            `<b>Order History</b>\n` +
            `${emoji} ${label}${duration}\n` +
            limitNote +
            `\n` +
            `${lines.join('\n')}\n` +
            SEPARATOR
        );
    }

    private static formatOrderLine(order: OrderDto, symbol: string): string {
        const sideEmoji = ORDER_SIDE_EMOJI[order.side] ?? '·';
        const side = order.side === OrderSide.Buy ? 'Buy ' : 'Sell';
        const p = order.price !== null ? `$${PriceFormatter.format(order.price)}` : '—';
        const amt = order.amount;
        return `${sideEmoji} ${side}  Lv.${order.levelIndex + 1}  ${p} · ${amt} ${symbol}`;
    }

    private static headerParts(grid: GridWithPnl['grid']) {
        return {
            pair: `${grid.symbol}/USDC`,
            shortId: grid.id.slice(0, 8),
            emoji: STATUS_EMOJI[grid.status] ?? EMOJI.WARNING,
            label: STATUS_LABEL[grid.status] ?? grid.status,
            duration: grid.startedAt
                ? ` · ${GridListItemMessage.formatDuration(grid.startedAt)}`
                : '',
        };
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

    private static isOutOfRange(
        grid: { lowerPrice: number; upperPrice: number },
        currentPrice: number,
    ): boolean {
        return currentPrice < grid.lowerPrice || currentPrice > grid.upperPrice;
    }
}
