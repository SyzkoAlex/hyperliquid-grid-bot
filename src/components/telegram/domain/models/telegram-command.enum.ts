export enum TelegramCommand {
    Start = 'start',
    Help = 'help',
    Grids = 'grids',
    Balance = 'balance',
    Stats = 'stats',
    Settings = 'settings',
}

export enum TelegramAction {
    MainMenu = 'main:menu',
    ListGrids = 'list:grids',
    ShowBalance = 'show:balance',
    ShowStats = 'show:stats',
    CreateGrid = 'create:grid',
    ShowSettings = 'show:settings',
    ShowHelp = 'show:help',
    RefreshInfo = 'refresh_info',
    ConfirmStop = 'confirm_stop',
    CancelStop = 'cancel_stop',
}

export const GridAction = {
    view: (id: string) => `view:grid:${id}`,
    ordersTab: (id: string) => `view:grid:${id}:orders`,
    historyTab: (id: string) => `view:grid:${id}:history`,
    stop: (id: string) => `stop:grid:${id}`,
    confirmStop: (id: string) => `confirm:stop:${id}`,
    cancelStop: (id: string) => `cancel:stop:${id}`,
    VIEW_PATTERN: /^view:grid:([^:]+)$/,
    VIEW_ORDERS_PATTERN: /^view:grid:(.+):orders$/,
    VIEW_HISTORY_PATTERN: /^view:grid:(.+):history$/,
    STOP_PATTERN: /^stop:grid:(.+)$/,
    CONFIRM_STOP_PATTERN: /^confirm:stop:(.+)$/,
    CANCEL_STOP_PATTERN: /^cancel:stop:(.+)$/,
} as const;
