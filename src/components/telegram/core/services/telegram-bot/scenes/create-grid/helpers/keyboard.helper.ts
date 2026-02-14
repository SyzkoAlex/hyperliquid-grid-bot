import { Markup } from 'telegraf';
import { InlineButton } from '../../../../../domain/inline-button';
import { BotContext } from '../../../types/bot-context';

export async function replyWithKeyboard(
    ctx: BotContext,
    text: string,
    buttons?: InlineButton[][],
    parseMode: 'HTML' | 'Markdown' = 'HTML',
): Promise<void> {
    let message;

    if (!buttons) {
        message = await ctx.reply(text, { parse_mode: parseMode });
    } else {
        const keyboard = Markup.inlineKeyboard(
            buttons.map((row) => row.map((btn) => Markup.button.callback(btn.text, btn.action))),
        );
        message = await ctx.reply(text, { parse_mode: parseMode, ...keyboard });
    }

    if (ctx.session.createGrid && message?.message_id) {
        if (!ctx.session.createGrid.messageIds) {
            ctx.session.createGrid.messageIds = [];
        }
        ctx.session.createGrid.messageIds.push(message.message_id);
    }
}

export async function editMessageWithKeyboard(
    ctx: BotContext,
    text: string,
    buttons?: InlineButton[][],
    parseMode: 'HTML' | 'Markdown' = 'HTML',
): Promise<void> {
    if (!buttons) {
        await ctx.editMessageText(text, { parse_mode: parseMode });
        return;
    }

    const keyboard = Markup.inlineKeyboard(
        buttons.map((row) => row.map((btn) => Markup.button.callback(btn.text, btn.action))),
    );

    await ctx.editMessageText(text, { parse_mode: parseMode, ...keyboard });
}
