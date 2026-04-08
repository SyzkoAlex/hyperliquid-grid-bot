const CENTS = 100;

/**
 * Rounds a USDC amount to 2 decimal places (cents precision).
 * Used to avoid floating-point artifacts when comparing notional values
 * against minimums — ensures the comparison matches what is displayed to the user.
 */
export function roundToCents(value: number): number {
    return Math.round(value * CENTS) / CENTS;
}
