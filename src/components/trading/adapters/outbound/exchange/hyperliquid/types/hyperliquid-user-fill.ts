/**
 * Hyperliquid User Fills API Response Types
 *
 * These types represent the structure of Hyperliquid's /info endpoint
 * for userFills (retrieve user's trade fills/executions).
 *
 * Request: POST /info with { type: "userFills", user: "0x...", startTime?: number }
 *
 * @see https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint
 */

/**
 * Single fill/execution from Hyperliquid API (raw response)
 *
 * Represents a trade execution where an order was partially or fully filled.
 */
export interface HyperliquidUserFillResponse {
    /** Trading pair symbol (e.g., "BTC-SPOT", "ETH-SPOT") */
    coin: string;

    /** Execution price as string */
    px: string;

    /** Filled size as string */
    sz: string;

    /** Order side: "B" = Buy, "A" = Ask (Sell) */
    side: string;

    /** Execution timestamp in milliseconds (Unix epoch) */
    time: number;

    /** Position size before this fill as string */
    startPosition: string;

    /** Trade direction indicator */
    dir: string;

    /** Closed PnL as string (for perpetuals, usually "0" for spot) */
    closedPnl: string;

    /** Transaction hash on L1 */
    hash: string;

    /** Exchange order ID that was filled */
    oid: number;

    /** Whether this was a taker (crossed the spread) or maker order */
    crossed: boolean;

    /** Trading fee as string */
    fee: string;

    /** Token used for fee payment (e.g., "USDC") */
    feeToken: string;

    /** Trade ID - unique identifier for this fill */
    tid: number;

    /** Builder fee as string (optional, for frontend integrations) */
    builderFee?: string;

    /** Liquidation mark price (optional, for liquidation fills) */
    liquidationMarkPx?: string;

    /** TWAP order ID (optional, for TWAP orders) */
    twapId?: number;
}

/**
 * Mapped user fill for domain use
 *
 * Simplified representation with parsed numeric values.
 */
export interface UserFill {
    /** Trading pair symbol (e.g., "BTC", "ETH") */
    coin: string;

    /** Exchange order ID as string */
    exchangeOrderId: string;

    /** Order side */
    side: 'buy' | 'sell';

    /** Execution price as number */
    price: number;

    /** Filled size as number */
    size: number;

    /** Execution timestamp in milliseconds */
    time: number;

    /** Trading fee as number */
    fee: number;

    /** Whether this was a maker order (not crossed) */
    isMaker: boolean;

    /** Closed PnL as number */
    closedPnl: number;

    /** Trade ID */
    tid: number;
}
