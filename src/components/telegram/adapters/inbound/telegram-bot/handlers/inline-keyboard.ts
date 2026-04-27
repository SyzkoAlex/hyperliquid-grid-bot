import { Markup } from 'telegraf';
import { InlineButton } from '@components/telegram/core/domain/models/inline-button';

export function toInlineKeyboard(
    buttons: InlineButton[][],
): ReturnType<typeof Markup.inlineKeyboard> {
    return Markup.inlineKeyboard(
        buttons.map((row) =>
            row.map((btn) =>
                btn.url
                    ? Markup.button.url(btn.text, btn.url)
                    : Markup.button.callback(btn.text, btn.action!),
            ),
        ),
    );
}
