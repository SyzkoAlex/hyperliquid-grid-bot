/**
 * Hyperliquid Spot Meta API Response Types
 *
 * Response from: POST /info with type: "spotMeta"
 *
 * @see https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint
 */

/**
 * Spot token metadata
 */
export interface HyperliquidSpotToken {
    /** Token symbol (e.g., "BTC", "ETH", "HYPE") */
    name: string;

    /** Token ID in the system (used as @{tokenId} in mids) */
    tokenId: number;

    /** Number of decimals */
    szDecimals: number;
}

/**
 * Universe metadata (full list of available tokens)
 */
export interface HyperliquidUniverse {
    /** List of available spot tokens */
    tokens: HyperliquidSpotToken[];
}

/**
 * Complete spot meta response
 */
export interface HyperliquidSpotMetaResponse {
    /** List of available spot tokens */
    tokens: HyperliquidSpotToken[];

    /** Universe metadata */
    universe: HyperliquidUniverse[];
}
