/**
 * Exchange Order Status
 *
 * All possible order statuses returned by Hyperliquid API.
 * These statuses represent the exact state of an order on the exchange.
 */
export enum ExchangeOrderStatus {
    // Active and filled states
    OPEN = 'open',
    FILLED = 'filled',
    TRIGGERED = 'triggered',

    // User cancellations
    CANCELED = 'canceled',

    // System cancellations
    MARGIN_CANCELED = 'marginCanceled',
    VAULT_WITHDRAWAL_CANCELED = 'vaultWithdrawalCanceled',
    OPEN_INTEREST_CAP_CANCELED = 'openInterestCapCanceled',
    SELF_TRADE_CANCELED = 'selfTradeCanceled',
    REDUCE_ONLY_CANCELED = 'reduceOnlyCanceled',
    SIBLING_FILLED_CANCELED = 'siblingFilledCanceled',
    DELISTED_CANCELED = 'delistedCanceled',
    LIQUIDATED_CANCELED = 'liquidatedCanceled',
    SCHEDULED_CANCEL = 'scheduledCancel',

    // Rejections at placement
    REJECTED = 'rejected',
    TICK_REJECTED = 'tickRejected',
    MIN_TRADE_NTL_REJECTED = 'minTradeNtlRejected',
    PERP_MARGIN_REJECTED = 'perpMarginRejected',
    REDUCE_ONLY_REJECTED = 'reduceOnlyRejected',
    BAD_ALO_PX_REJECTED = 'badAloPxRejected',
    IOC_CANCEL_REJECTED = 'iocCancelRejected',
    BAD_TRIGGER_PX_REJECTED = 'badTriggerPxRejected',
    MARKET_ORDER_NO_LIQUIDITY_REJECTED = 'marketOrderNoLiquidityRejected',
    POSITION_INCREASE_AT_OPEN_INTEREST_CAP_REJECTED = 'positionIncreaseAtOpenInterestCapRejected',
    POSITION_FLIP_AT_OPEN_INTEREST_CAP_REJECTED = 'positionFlipAtOpenInterestCapRejected',
    TOO_AGGRESSIVE_AT_OPEN_INTEREST_CAP_REJECTED = 'tooAggressiveAtOpenInterestCapRejected',
    OPEN_INTEREST_INCREASE_REJECTED = 'openInterestIncreaseRejected',
    INSUFFICIENT_SPOT_BALANCE_REJECTED = 'insufficientSpotBalanceRejected',
    ORACLE_REJECTED = 'oracleRejected',
    PERP_MAX_POSITION_REJECTED = 'perpMaxPositionRejected',
}
