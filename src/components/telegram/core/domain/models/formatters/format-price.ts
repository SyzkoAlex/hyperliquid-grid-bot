import { formatFiat } from './format-fiat';

/**
 * Formats a price as fiat with `$` prefix.
 *
 * @example formatPrice(1234.56)    → "$1,234.56"
 * @example formatPrice(1234.567)   → "$1,234.57"
 * @example formatPrice(100)        → "$100.00"
 */
export function formatPrice(value: number): string {
    return `$${formatFiat(value)}`;
}
