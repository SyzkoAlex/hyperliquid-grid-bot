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
