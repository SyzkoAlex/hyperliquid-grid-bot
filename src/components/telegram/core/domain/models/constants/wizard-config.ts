export const WIZARD_CONFIG = {
    MIN_INVESTMENT: 10,
    PRICE_RANGE_PERCENT: 20,
    DEFAULT_LEVELS: 10,
    MIN_LEVELS: 3,
    MAX_LEVELS: 100,
    PRESET_LEVELS: [5, 10, 20, 50],
} as const;

export const HYPERLIQUID_SPOT_FEE = {
    takerRate: 0.0007, // 0.07%
    makerRate: 0.0004, // 0.04%
} as const;
