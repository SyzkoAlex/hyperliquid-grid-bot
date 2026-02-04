import { GridId } from '../grid/grid-id';
import { OrderId } from '../order/order-id';

/**
 * Exchange CLOID
 *
 * Hyperliquid-compatible order identifier for tracking orders.
 * Converts OrderId (UUID format) to hexadecimal format required by Hyperliquid API (CLOID).
 *
 * Format: "0x" + UUID without dashes
 * Example: OrderId "550e8400-e29b-41d4-a716-446655440000" → "0x550e8400e29b41d4a716446655440000"
 *
 * Use Cases:
 * - Track individual orders on the exchange
 * - Enable order reconciliation between local DB and exchange
 * - Maintain unique order identification through exchange lifecycle
 */
export class ExchangeCloid {
    private constructor(private readonly value: string) {}

    static create(orderId: OrderId): ExchangeCloid {
        const hexValue = `0x${orderId.toString().replace(/-/g, '')}`;
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
     * Parse CLOID hex string to OrderId
     *
     * Converts hex-encoded CLOID (format: 0x{uuid without dashes})
     * to UUID format (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
     *
     * @param cloid - Hex-encoded order ID from Hyperliquid API
     * @returns OrderId if valid format, undefined otherwise
     *
     * @example
     * ExchangeCloid.parse('0x550d0a202bac446a8a2adbb1d378f564')
     * // Returns: OrderId from '550d0a20-2bac-446a-8a2a-dbb1d378f564'
     */
    static parse(cloid: string | undefined): OrderId | undefined {
        if (!cloid) {
            return undefined;
        }

        try {
            const hex = cloid.replace('0x', '');
            const uuidStr = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
            return OrderId.from(uuidStr);
        } catch (error) {
            return undefined;
        }
    }

    /**
     * Parse CLOID hex string to GridId (legacy support)
     */
    static parseGridId(cloid: string | undefined): GridId | undefined {
        if (!cloid) {
            return undefined;
        }

        try {
            const hex = cloid.replace('0x', '');
            const uuidStr = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
            return GridId.from(uuidStr);
        } catch (error) {
            return undefined;
        }
    }

    toString(): string {
        return this.value;
    }

    toOrderId(): OrderId | undefined {
        return ExchangeCloid.parse(this.value);
    }
}
