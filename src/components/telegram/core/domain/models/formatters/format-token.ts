/**
 * Formats a token amount with max 5 decimal places.
 * Prepends `~` when rounding occurs.
 *
 * @example formatToken(0.00345)          → "0.00345"
 * @example formatToken(0.00345123456)    → "~0.00345"
 * @example formatToken(100)              → "100"
 * @example formatToken(1.5)              → "1.5"
 */
export function formatToken(value: number): string {
    const maxDecimals = 5;
    const fixed = value.toFixed(maxDecimals);
    const parsed = parseFloat(fixed);
    const trimmed = parsed.toString();
    const isApprox = parsed !== value;
    return isApprox ? `~${trimmed}` : trimmed;
}
