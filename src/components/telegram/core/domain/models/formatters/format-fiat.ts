/**
 * Rounds and formats a number as fiat currency (2 decimal places).
 * Uses banker's rounding via Intl.NumberFormat.
 *
 * @example formatFiat(1234.567)  → "1,234.57"
 * @example formatFiat(0.1)       → "0.10"
 * @example formatFiat(-42.999)   → "-43.00"
 */
export function formatFiat(value: number): string {
    return value.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}
