/**
 * Hyperliquid Order Status API Response Types
 *
 * These types represent the structure of Hyperliquid's /info endpoint
 * for orderStatus (query specific order status by OID or CLOID).
 *
 * Request: POST /info with { type: "orderStatus", user: "0x...", oid: number | string }
 *
 * More reliable than batch history query - directly queries specific order status.
 * Useful for checking closed orders without relying on 2000-record limit.
 *
 * @see https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint#query-order-status-by-oid-or-cloid
 */

/**
 * Order status response - discriminated union based on status field
 */
export type HyperliquidOrderStatusResponse =
    | HyperliquidOrderStatusFound
    | HyperliquidOrderStatusUnknown;

/**
 * Response when order is found in the system
 */
export interface HyperliquidOrderStatusFound {
    /** Discriminator: order was found */
    status: 'order';

    /** Order container with nested order details and status */
    order: {
        /** Order details */
        order: {
            /** Trading pair symbol (e.g., "BTC-SPOT", "ETH-SPOT") */
            coin: string;

            /** Order side: "B" = Buy, "A" = Ask (Sell) */
            side: string;

            /** Limit price as string */
            limitPx: string;

            /** Remaining size as string */
            sz: string;

            /** Exchange order ID */
            oid: number;

            /** Order creation timestamp in milliseconds (Unix epoch) */
            timestamp: number;

            /** Original order size before any fills */
            origSz: string;

            /**
             * Client Order ID (CLOID) - 128-bit hex string
             *
             * Used to track which grid an order belongs to.
             */
            cloid?: string | null;
        };

        /**
         * Order status
         *
         * - "filled": Order completely filled
         * - "open": Order still active
         * - "canceled": Order cancelled by user
         * - "triggered": Trigger order activated
         * - "triggerRejected": Trigger order rejected
         * - "rejected": Order rejected by exchange
         * - "marginCanceled": Order cancelled due to insufficient margin
         */
        status: string;

        /** Timestamp when order reached current status in milliseconds (Unix epoch) */
        statusTimestamp: number;
    };
}

/**
 * Response when order is not found in the system
 */
export interface HyperliquidOrderStatusUnknown {
    /** Discriminator: order not found */
    status: 'unknownOid';
}

/**
 * Request payload for orderStatus info endpoint
 */
export interface HyperliquidOrderStatusRequest {
    type: 'orderStatus';

    /** User wallet address (42-character hex with 0x prefix) */
    user: string;

    /**
     * Order identifier
     *
     * Can be either:
     * - number: Exchange order ID (oid)
     * - string: Client order ID (cloid) as hex string
     */
    oid: number | string;
}
