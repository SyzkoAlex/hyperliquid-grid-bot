export const WIZARD_CONFIG = {
    MIN_INVESTMENT: 10,
    PRICE_RANGE_PERCENT: 20,
    DEFAULT_ORDERS: 10,
    MIN_ORDERS: 5,
    MAX_ORDERS: 100,
    PRESET_ORDERS: [5, 10, 20, 50],
    /**
     * After a spot swap the exchange balance endpoint may lag behind the fill
     * settlement. Wait this many ms before re-fetching balance so the preset
     * buttons reflect the post-swap state.
     */
    SWAP_BALANCE_SETTLE_DELAY_MS: 1000,
} as const;
