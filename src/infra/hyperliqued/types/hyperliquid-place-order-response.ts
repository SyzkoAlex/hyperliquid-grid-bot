/**
 * Hyperliquid Place Order Response Types
 *
 * These types represent the response structure from placing orders
 * via Hyperliquid SDK exchange.placeOrder().
 *
 * Note: Order placement uses the Hyperliquid SDK, not direct HTTP calls.
 * The SDK returns a structured response after order submission.
 *
 * @see https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint
 */

/**
 * Response from Hyperliquid SDK after placing an order
 */
export interface HyperliquidPlaceOrderResponse {
    /** Overall request status: "ok" for success */
    status: string;

    /** Response details containing order results */
    response: {
        /** Response type identifier */
        type: string;

        /** Response data with order statuses (present on success) */
        data?: {
            /** Array of order status results (one per order in batch) */
            statuses: Array<{
                /**
                 * Filled order information (present when order crossed the spread)
                 */
                filled?: {
                    /** Exchange order ID assigned by Hyperliquid */
                    oid: number;

                    /** Total size filled */
                    totalSz?: string;

                    /** Average fill price */
                    avgPx?: string;
                };

                /**
                 * Resting order information (present when limit order placed on book)
                 */
                resting?: {
                    /** Exchange order ID assigned by Hyperliquid */
                    oid: number;
                };

                /**
                 * Error message (present when order placement failed)
                 */
                error?: string;
            }>;
        };
    };
}
