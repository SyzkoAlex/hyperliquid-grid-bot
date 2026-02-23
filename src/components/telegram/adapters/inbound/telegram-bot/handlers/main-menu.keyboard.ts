import { InlineButton } from '@components/telegram/core/domain/models/inline-button';
import { TelegramAction } from '@components/telegram/core/domain/models/telegram-command.enum';
import { Markup } from 'telegraf';

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

export function replyMenuKeyboard(): ReturnType<typeof Markup.keyboard> {
    return Markup.keyboard([
        ['📊 Grids', '💰 Balance'],
        ['📈 Stats', '➕ Create Grid'],
        ['⚙️ Settings', '❓ Help'],
    ]).resize();
}

export function backToMenuKeyboard(): InlineButton[][] {
    return [[{ text: '« Back to Menu', action: TelegramAction.MainMenu }]];
}
