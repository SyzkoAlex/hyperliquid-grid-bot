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

    /** Token index in the tokens array (used as @{index} in API calls) */
    index: number;

    /** Hex token ID */
    tokenId: string;

    /** Number of decimals */
    szDecimals: number;
}

/**
 * Universe metadata (spot market pair)
 */
export interface HyperliquidUniverse {
    /** Spot pair name (e.g., "HYPE/USDC") */
    name: string;

    /** [baseTokenIndex, quoteTokenIndex] — indices into the tokens array */
    tokens: number[];

    /** Spot market index (used as @{index} key in getAllMids and L2 book) */
    index: number;
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
