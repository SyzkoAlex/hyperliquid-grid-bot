import { Markup } from 'telegraf';
import { InlineButton } from '@components/telegram/core/domain/models/inline-button';

export function toInlineKeyboard(
    buttons: InlineButton[][],
): ReturnType<typeof Markup.inlineKeyboard> {
    return Markup.inlineKeyboard(
        buttons.map((row) => row.map((btn) => Markup.button.callback(btn.text, btn.action))),
    );
}
