/**
 * Hyperliquid Place Order Request Types
 *
 * These types represent the request structure for placing orders
 * via Hyperliquid SDK exchange.placeOrder().
 *
 * Note: Order placement uses the Hyperliquid SDK, not direct HTTP calls.
 * The SDK handles signing and submitting the order to the exchange.
 *
 * @see https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint
 */

/**
 * Parameters for placing a limit order on Hyperliquid
 *
 * Used internally when constructing SDK order requests.
 */
export interface HyperliquidPlaceOrderRequest {
    /** Trading pair symbol (e.g., "BTC", "ETH") - SDK adds -SPOT suffix */
    coin: string;

    /** Order side: true = Buy, false = Sell */
    is_buy: boolean;

    /** Order size (amount of base asset) */
    sz: number;

    /** Limit price in quote currency (USDC) */
    limit_px: number;

    /** Whether this order only reduces an existing position */
    reduce_only: boolean;

    /**
     * Client Order ID (CLOID) - 128-bit hex string
     *
     * Used to track which grid an order belongs to by encoding the gridId.
     * Format: 0x{gridId without dashes}
     * Example: "0x550e8400e29b41d4a716446655440000"
     *
     * This allows matching filled orders back to their originating grid
     * without relying on exchange order IDs.
     */
    cloid?: string;
}
