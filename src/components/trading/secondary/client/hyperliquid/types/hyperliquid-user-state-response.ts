/**
 * Hyperliquid Spot User State API Response Types
 *
 * These types represent the structure of Hyperliquid's /info endpoint
 * for spotClearinghouseState (spot balances).
 *
 * @see https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/spot
 */

/**
 * Spot balance for a single token (API response)
 */
export interface HyperliquidSpotBalance {
    /** Token symbol (e.g., "USDC", "BTC", "ETH") */
    coin: string;

    /** Token index in the system */
    token: number;

    /** Amount held in open orders (not available for withdrawal) */
    hold: string;

    /** Total balance including held amount */
    total: string;

    /** Entry notional value in USDC */
    entryNtl: string;
}

/**
 * Complete spot user state from Hyperliquid (API response)
 *
 * Response from: POST /info with type: "spotClearinghouseState"
 */
export interface HyperliquidSpotUserStateResponse {
    /** List of token balances */
    balances: HyperliquidSpotBalance[];
}
