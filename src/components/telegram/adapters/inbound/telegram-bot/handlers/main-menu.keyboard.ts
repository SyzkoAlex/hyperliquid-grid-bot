import { InlineButton } from '@components/telegram/core/domain/models/inline-button';
import { TelegramAction } from '@components/telegram/core/domain/models/telegram-action';
import { GridsAction } from '@components/telegram/core/domain/models/grids-action';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels';
import { Markup } from 'telegraf';

export function mainMenuKeyboard(): InlineButton[][] {
    return [
        [
            { text: BUTTON_LABELS.GRIDS, action: TelegramAction.ListGrids },
            { text: BUTTON_LABELS.STOPPED_GRIDS, action: GridsAction.stoppedPage(1) },
        ],
        [
            { text: BUTTON_LABELS.BALANCE, action: TelegramAction.ShowBalance },
            { text: BUTTON_LABELS.CREATE_GRID, action: TelegramAction.CreateGrid },
        ],
        [
            { text: BUTTON_LABELS.SETTINGS, action: TelegramAction.ShowSettings },
            { text: BUTTON_LABELS.HELP, action: TelegramAction.ShowHelp },
        ],
    ];
}

const REPLY_MENU_ROWS: string[][] = [
    [BUTTON_LABELS.GRIDS, BUTTON_LABELS.STOPPED_GRIDS],
    [BUTTON_LABELS.BALANCE, BUTTON_LABELS.CREATE_GRID],
    [BUTTON_LABELS.SETTINGS, BUTTON_LABELS.HELP],
];

const REPLY_MENU_LABELS = new Set(REPLY_MENU_ROWS.flat());

export function replyMenuKeyboard(): ReturnType<typeof Markup.keyboard> {
    return Markup.keyboard(REPLY_MENU_ROWS).resize();
}

export function isReplyMenuText(text: string): boolean {
    return REPLY_MENU_LABELS.has(text);
}
