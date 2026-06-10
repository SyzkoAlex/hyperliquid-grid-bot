export enum InvestmentPresetKey {
    P25 = '25',
    P50 = '50',
    P75 = '75',
    Max = 'max',
    Custom = 'custom',
}

export enum StopLossPresetKey {
    P5 = '5',
    P10 = '10',
    P20 = '20',
    Custom = 'custom',
}

export enum PricePresetKey {
    Custom = 'custom',
}

export const CREATE_GRID_ACTIONS = {
    PAIR_PREFIX: 'create_grid:pair:',
    OTHER_PAIR: 'create_grid:other_pair',
    MODE_QUICK: 'create_grid:mode:quick',
    MODE_ADVANCED: 'create_grid:mode:advanced',
    LEVELS_PREFIX: 'create_grid:levels:',
    STOP_LOSS_OFF: 'create_grid:stop_loss:off',
    UPPER_PRESET_PREFIX: 'create_grid:upper:',
    LOWER_PRESET_PREFIX: 'create_grid:lower:',
    QUICK_INVESTMENT_PRESET_PREFIX: 'create_grid:quick_invest:',
    ADV_INVESTMENT_PRESET_PREFIX: 'create_grid:adv_invest:',
    STOP_LOSS_PRESET_PREFIX: 'create_grid:sl:',
    SWAP_OFFER: 'create_grid:swap_offer',
    SWAP_CONFIRM: 'create_grid:swap_confirm',
    SWAP_SKIP: 'create_grid:swap_skip',
    CONFIRM: 'create_grid:confirm',
    BACK: 'create_grid:back',
    CANCEL: 'create_grid:cancel',
} as const;

// Regex patterns for dynamic actions
export const CREATE_GRID_PATTERNS = {
    PAIR: /^create_grid:pair:(.+)$/,
    LEVELS: /^create_grid:levels:(.+)$/,
    UPPER_PRESET: /^create_grid:upper:(\d+|custom)$/,
    LOWER_PRESET: /^create_grid:lower:(\d+|custom)$/,
    QUICK_INVESTMENT_PRESET: /^create_grid:quick_invest:(25|50|75|max|custom)$/,
    ADV_INVESTMENT_PRESET: /^create_grid:adv_invest:(25|50|75|max|custom)$/,
    STOP_LOSS_PRESET: /^create_grid:sl:(5|10|20|custom)$/,
} as const;

export const buildPairAction = (symbol: string): string =>
    `${CREATE_GRID_ACTIONS.PAIR_PREFIX}${symbol}`;

export const buildLevelsAction = (levels: number): string =>
    `${CREATE_GRID_ACTIONS.LEVELS_PREFIX}${levels}`;

export const buildUpperPreset = (pct: number | PricePresetKey): string =>
    `${CREATE_GRID_ACTIONS.UPPER_PRESET_PREFIX}${pct}`;

export const buildLowerPreset = (pct: number | PricePresetKey): string =>
    `${CREATE_GRID_ACTIONS.LOWER_PRESET_PREFIX}${pct}`;

export const buildQuickInvestmentPreset = (key: InvestmentPresetKey): string =>
    `${CREATE_GRID_ACTIONS.QUICK_INVESTMENT_PRESET_PREFIX}${key}`;

export const buildAdvInvestmentPreset = (key: InvestmentPresetKey): string =>
    `${CREATE_GRID_ACTIONS.ADV_INVESTMENT_PRESET_PREFIX}${key}`;

export const buildStopLossPreset = (key: StopLossPresetKey): string =>
    `${CREATE_GRID_ACTIONS.STOP_LOSS_PRESET_PREFIX}${key}`;
