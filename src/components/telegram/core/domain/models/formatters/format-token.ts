/**
 * Formats a token amount with max 5 decimal places.
 *
 * @example formatToken(0.00345)          → "0.00345"
 * @example formatToken(0.00345123456)    → "0.00345"
 * @example formatToken(100)              → "100"
 * @example formatToken(1.5)              → "1.5"
 */
export function formatToken(value: number): string {
    return parseFloat(value.toFixed(5)).toString();
}
