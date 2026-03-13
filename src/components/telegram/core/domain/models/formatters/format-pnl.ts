import { PriceFormatter } from './price.formatter';

export function formatPnl(pnl: number): string {
    const sign = pnl >= 0 ? '+' : '-';
    return `${sign}$${PriceFormatter.format(Math.abs(pnl))}`;
}

export function formatPnlPercent(pnl: number, investment: number): string {
    if (investment === 0) return '0.00%';
    const pct = (pnl / investment) * 100;
    const sign = pct >= 0 ? '+' : '';
    return `${sign}${pct.toFixed(2)}%`;
}
