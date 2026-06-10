/**
 * Exchange CLOID
 *
 * Hyperliquid-compatible order identifier for tracking orders.
 * Converts order ID (UUID format) to hexadecimal format required by Hyperliquid API (CLOID).
 *
 * Format: "0x" + UUID without dashes
 * Example: "550e8400-e29b-41d4-a716-446655440000" → "0x550e8400e29b41d4a716446655440000"
 *
 * Use Cases:
 * - Track individual orders on the exchange
 * - Enable order reconciliation between local DB and exchange
 * - Maintain unique order identification through exchange lifecycle
 */
export class ExchangeCloid {
    private constructor(private readonly value: string) {}

    static create(orderId: string): ExchangeCloid {
        const hexValue = `0x${orderId.replace(/-/g, '')}`;
        return new ExchangeCloid(hexValue);
    }

    /**
     * Create ExchangeCloid from hex string (CLOID format)
     *
     * @param cloid - Hex-encoded order UID from exchange
     * @returns ExchangeCloid instance
     */
    static fromString(cloid: string): ExchangeCloid {
        return new ExchangeCloid(cloid);
    }

    /**
     * Parse CLOID hex string to order ID string (UUID format)
     *
     * Converts hex-encoded CLOID (format: 0x{uuid without dashes})
     * to UUID format (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
     *
     * @param cloid - Hex-encoded order ID from Hyperliquid API
     * @returns UUID string if valid format, undefined otherwise
     *
     * @example
     * ExchangeCloid.parse('0x550d0a202bac446a8a2adbb1d378f564')
     * // Returns: '550d0a20-2bac-446a-8a2a-dbb1d378f564'
     */
    static parse(cloid: string | undefined): string | undefined {
        if (!cloid) {
            return undefined;
        }

        try {
            const hex = cloid.replace('0x', '');
            const uuidStr = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
            // Validate UUID-like format (32 hex chars)
            if (hex.length !== 32) return undefined;
            if (!/^[0-9a-fA-F]+$/.test(hex)) return undefined;
            return uuidStr;
        } catch (_error) {
            return undefined;
        }
    }

    toString(): string {
        return this.value;
    }

    toOrderId(): string | undefined {
        return ExchangeCloid.parse(this.value);
    }
}
