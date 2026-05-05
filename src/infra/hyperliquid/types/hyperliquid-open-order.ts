/**
 * Hyperliquid Open Orders API Response Types
 *
 * These types represent the structure of Hyperliquid's /info endpoint
 * for openOrders (retrieve user's open orders).
 *
 * Request: POST /info with { type: "openOrders", user: "0x..." }
 *
 * @see https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint
 */

/**
 * Single open order from Hyperliquid API
 *
 * Represents an active limit order on the exchange.
 */
export interface HyperliquidOpenOrder {
    /** Trading pair symbol (e.g., "BTC-SPOT", "ETH-SPOT") */
    coin: string;

    /** Order side: "B" = Buy, "A" = Ask (Sell) */
    side: 'B' | 'A';

    /** Limit price as string */
    limitPx: string;

    /** Current remaining size as string (decreases as order fills) */
    sz: string;

    /** Exchange order ID - unique identifier assigned by Hyperliquid */
    oid: number;

    /** Order placement timestamp in milliseconds (Unix epoch) */
    timestamp: number;

    /** Original order size before any partial fills */
    origSz?: string;

    /** Whether this order only reduces an existing position */
    reduceOnly?: boolean;

    /**
     * Client Order ID (CLOID) - 128-bit hex string
     *
     * Used to track which grid an order belongs to by encoding the gridId.
     * Format: 0x{gridId without dashes}
     * Example: "0x550e8400e29b41d4a716446655440000"
     */
    cloid?: string;
}
