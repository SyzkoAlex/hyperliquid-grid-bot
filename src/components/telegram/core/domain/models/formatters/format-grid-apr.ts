export function formatGridApr(
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
