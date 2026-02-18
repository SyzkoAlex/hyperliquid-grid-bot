import { InlineButton } from '@components/telegram/domain/models/inline-button';
import { TelegramAction } from '@components/telegram/domain/models/telegram-command.enum';

export function mainMenuKeyboard(): InlineButton[][] {
    return [
        [
            { text: '📊 Grids', action: TelegramAction.ListGrids },
            { text: '💰 Balance', action: TelegramAction.ShowBalance },
        ],
        [
            { text: '📈 Stats', action: TelegramAction.ShowStats },
            { text: '➕ Create Grid', action: TelegramAction.CreateGrid },
        ],
        [
            { text: '⚙️ Settings', action: TelegramAction.ShowSettings },
            { text: '❓ Help', action: TelegramAction.ShowHelp },
        ],
    ];
}

export function backToMenuKeyboard(): InlineButton[][] {
    return [[{ text: '« Back to Menu', action: TelegramAction.MainMenu }]];
}
