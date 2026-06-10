export const WIZARD_CONFIG = {
    MIN_INVESTMENT: 10,
    PRICE_RANGE_PERCENT: 20,
    DEFAULT_LEVELS: 10,
    MIN_LEVELS: 3,
    MAX_LEVELS: 100,
    PRESET_LEVELS: [5, 10, 20, 50],
    /**
     * After a spot swap the exchange balance endpoint may lag behind the fill
     * settlement. Wait this many ms before re-fetching balance so the preset
     * buttons reflect the post-swap state.
     */
    SWAP_BALANCE_SETTLE_DELAY_MS: 1000,
} as const;
