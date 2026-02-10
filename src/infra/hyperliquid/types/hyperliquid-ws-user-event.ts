/**
 * Hyperliquid WebSocket User Event Types
 *
 * These types represent the structure of real-time events received
 * from Hyperliquid WebSocket channels.
 *
 * Used for real-time order status updates.
 *
 * WebSocket URL: wss://api.hyperliquid.xyz/ws
 *
 * @see https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/websocket
 */

/**
 * Single fill event from WebSocket
 *
 * Represents a real-time notification of an order fill.
 */
export interface HyperliquidWsFill {
    /** Trading pair symbol (e.g., "BTC-SPOT", "ETH-SPOT") */
    coin: string;

    /** Execution price as string */
    px: string;

    /** Filled size as string */
    sz: string;

    /** Order side: "B" = Buy, "A" = Ask (Sell) */
    side: 'B' | 'A';

    /** Execution timestamp in milliseconds (Unix epoch) */
    time: number;

    /** Position size before this fill as string */
    startPosition: string;

    /** Trade direction indicator */
    dir: string;

    /** Closed PnL as string (for perpetuals, usually "0" for spot) */
    closedPnl: string;

    /** Exchange order ID that was filled */
    oid: number;

    /** Whether this was a taker order (crossed the spread) */
    crossed: boolean;

    /** Trading fee as string */
    fee: string;

    /** Trade ID - unique identifier for this fill */
    tid: number;

    /**
     * Client Order ID (CLOID) - 128-bit hex string
     *
     * Used to identify which grid an order belongs to.
     * Format: 0x{gridId without dashes}
     */
    cloid?: string;
}

/**
 * Order status update from WebSocket
 *
 * Represents a real-time notification of order status change.
 */
export interface HyperliquidWsOrderStatus {
    /** Order details */
    order: {
        /** Trading pair symbol (e.g., "BTC-SPOT") */
        coin: string;

        /** Exchange order ID */
        oid: number;

        /** Order side: "B" = Buy, "A" = Ask (Sell) */
        side: 'B' | 'A';

        /** Limit price as string */
        limitPx: string;

        /** Order size as string */
        sz: string;

        /** Order creation timestamp in milliseconds (Unix epoch) */
        timestamp: number;
    };

    /**
     * Current order status
     *
     * - "open": Order placed and active
     * - "filled": Order completely filled
     * - "canceled": Order cancelled by user
     * - "triggered": Trigger order activated
     * - "rejected": Order rejected by exchange
     * - "marginCanceled": Order cancelled due to insufficient margin
     */
    status: string;

    /** Timestamp when order reached current status in milliseconds (Unix epoch) */
    statusTimestamp: number;
}

/**
 * User fills WebSocket event
 *
 * Received on "userFills" channel subscription.
 * Includes both initial snapshot and real-time updates.
 */
export interface HyperliquidWsUserFillsEvent {
    /** Channel identifier */
    channel: 'userFills';

    /** Event data */
    data: {
        /** True for initial snapshot, false for incremental updates */
        isSnapshot: boolean;

        /** User wallet address */
        user: string;

        /** Array of fill events */
        fills: HyperliquidWsFill[];
    };
}

/**
 * Order updates WebSocket event
 *
 * Received on "orderUpdates" or "userEvents" channel subscription.
 * Contains array of order status updates.
 */
export interface HyperliquidWsUserEventsEvent {
    /** Channel identifier */
    channel: 'orderUpdates' | 'userEvents';

    /** Array of order status updates */
    data: HyperliquidWsOrderStatus[];
}

/**
 * WebSocket subscription request for user events
 *
 * Send this message to subscribe to real-time user updates.
 */
export interface HyperliquidWsUserSubscription {
    /** WebSocket method */
    method: 'subscribe';

    /** Subscription details */
    subscription: {
        /** Event type to subscribe to */
        type: 'orderUpdates' | 'userEvents' | 'userFills';

        /** User wallet address (42-character hex with 0x prefix) */
        user: string;
    };
}
