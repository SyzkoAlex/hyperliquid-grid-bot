import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels';
import { Markup } from 'telegraf';

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
