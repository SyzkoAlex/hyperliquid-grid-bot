/**
 * Hyperliquid Historical Orders API Response Types
 *
 * These types represent the structure of Hyperliquid's /info endpoint
 * for historicalOrders (retrieve user's order history with status).
 *
 * Request: POST /info with { type: "historicalOrders", user: "0x..." }
 *
 * IMPORTANT: API returns at most 2000 most recent historical orders.
 * Does NOT support time filtering - use client-side filtering if needed.
 *
 * @see https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint
 */

/**
 * Single historical order from Hyperliquid API
 *
 * Contains order details and final status information.
 */
export interface HyperliquidHistoricalOrder {
    /** Order details */
    order: {
        /** Trading pair symbol (e.g., "BTC-SPOT", "ETH-SPOT") */
        coin: string;

        /** Order side: "B" = Buy, "A" = Ask (Sell) */
        side: 'B' | 'A';

        /** Limit price as string */
        limitPx: string;

        /** Remaining size as string */
        sz: string;

        /** Exchange order ID */
        oid: number;

        /** Order creation timestamp in milliseconds (Unix epoch) */
        timestamp: number;

        /**
         * Client Order ID (CLOID) - 128-bit hex string
         *
         * Used to track which grid an order belongs to.
         * Format: 0x{gridId without dashes}
         */
        cloid?: string;

        /** Original order size before any fills */
        origSz: string;

        /** Time in force (e.g., "Gtc" = Good Till Cancel) */
        tif: string;
    };

    /**
     * Final order status
     *
     * - "filled": Order completely filled
     * - "open": Order still active (shouldn't appear in historical)
     * - "canceled": Order cancelled by user
     * - "triggered": Trigger order activated
     * - "rejected": Order rejected by exchange
     * - "marginCanceled": Order cancelled due to insufficient margin
     */
    status: 'filled' | 'open' | 'canceled' | 'triggered' | 'rejected' | 'marginCanceled';

    /** Timestamp when order reached current status in milliseconds (Unix epoch) */
    statusTimestamp: number;
}

/**
 * Request payload for historicalOrders info endpoint
 */
export interface HyperliquidHistoricalOrdersRequest {
    type: 'historicalOrders';

    /** User wallet address (42-character hex with 0x prefix) */
    user: string;
}
