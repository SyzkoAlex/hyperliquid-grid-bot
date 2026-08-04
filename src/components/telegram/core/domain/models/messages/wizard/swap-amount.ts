/**
 * Converts a USDC-denominated swap amount into a base-token quantity, formatted to 6dp.
 * OptimalSwapDto.amountUsdc is always a USDC notional — for the BaseToUsdc direction it
 * must be divided by price before display next to the base symbol, or it reads as a
 * token quantity many times too large (e.g. "~541.98 HYPE" instead of "~12.80 HYPE").
 */
export function baseQuantityFromUsdc(amountUsdc: number, currentPrice: number): string {
    if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
        return '?';
    }
    return (amountUsdc / currentPrice).toFixed(6);
}
