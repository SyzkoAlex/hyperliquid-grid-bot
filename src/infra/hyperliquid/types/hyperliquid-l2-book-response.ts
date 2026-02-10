/**
 * Hyperliquid L2 Order Book API Response Types
 *
 * Response from: POST /info with type: "l2Book"
 *
 * @see https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint
 */

/**
 * Price level in order book
 */
export interface L2BookLevel {
    /** Price */
    px: string;

    /** Size (quantity) */
    sz: string;

    /** Number of orders at this level */
    n: number;
}

/**
 * L2 order book response
 */
export interface L2BookResponse {
    /** Coin/trading pair (e.g., "HYPE/USDC") */
    coin: string;

    /** Timestamp in milliseconds */
    time: number;

    /**
     * Order book levels
     * [0] = bids (buy orders, descending by price)
     * [1] = asks (sell orders, ascending by price)
     */
    levels: [L2BookLevel[], L2BookLevel[]];
}
