// Callback action constants for create grid scene

export const CREATE_GRID_ACTIONS = {
    // Pair selection
    PAIR_PREFIX: 'create_grid:pair:',
    OTHER_PAIR: 'create_grid:other_pair',

    // Mode selection
    MODE_QUICK: 'create_grid:mode:quick',
    MODE_ADVANCED: 'create_grid:mode:advanced',

    // Levels selection
    LEVELS_PREFIX: 'create_grid:levels:',

    // Stop-loss selection
    STOP_LOSS_OFF: 'create_grid:stop_loss:off',

    // Navigation
    CONFIRM: 'create_grid:confirm',
    BACK: 'create_grid:back',
    CANCEL: 'create_grid:cancel',
} as const;

// Regex patterns for dynamic actions
export const CREATE_GRID_PATTERNS = {
    PAIR: /^create_grid:pair:(.+)$/,
    LEVELS: /^create_grid:levels:(.+)$/,
} as const;

// Helper functions to build callback data
export const buildPairAction = (symbol: string): string =>
    `${CREATE_GRID_ACTIONS.PAIR_PREFIX}${symbol}`;

export const buildLevelsAction = (levels: number): string =>
    `${CREATE_GRID_ACTIONS.LEVELS_PREFIX}${levels}`;
