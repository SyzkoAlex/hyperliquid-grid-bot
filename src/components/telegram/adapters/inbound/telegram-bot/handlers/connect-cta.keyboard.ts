import { InlineButton } from '@components/telegram/core/domain/models/inline-button';
import { TelegramAction } from '@components/telegram/core/domain/models/telegram-action';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels';
import { ConnectAccountMessages } from '@components/telegram/core/domain/models/messages/wizard/connect-account.messages';
import { TelegramParseMode } from '@components/telegram/core/domain/models/telegram-parse-mode';
import { BotContext } from '../types/bot-context';
import { toInlineKeyboard } from './inline-keyboard';

export function connectCtaKeyboard(): InlineButton[][] {
    return [[{ text: BUTTON_LABELS.CONNECT, action: TelegramAction.ConnectAccount }]];
}

/** Sends the "connect your account" explanation card with the Connect inline button. */
export async function replyConnectCta(ctx: BotContext): Promise<void> {
    await ctx.reply(ConnectAccountMessages.whyConnect(), {
        parse_mode: TelegramParseMode.HTML,
        ...toInlineKeyboard(connectCtaKeyboard()),
    });
}
