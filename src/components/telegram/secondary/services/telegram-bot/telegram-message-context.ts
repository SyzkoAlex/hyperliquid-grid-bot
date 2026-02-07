import { Markup } from 'telegraf';
import { MessageContext } from '../../../core/domain/message-context';
import { InlineButton } from '../../../core/domain/inline-button';
import { BotContext } from './types/bot-context';

export class TelegramMessageContext implements MessageContext {
    readonly chatId: number | undefined;

    constructor(private readonly ctx: BotContext) {
        this.chatId = ctx.chat?.id;
    }

    async reply(text: string, keyboard?: InlineButton[][]): Promise<void> {
        await this.ctx.reply(text, {
            parse_mode: 'HTML',
            reply_markup: keyboard ? this.buildKeyboard(keyboard) : undefined,
        });
    }

    async editMessage(text: string, keyboard?: InlineButton[][]): Promise<void> {
        await this.ctx.editMessageText(text, {
            parse_mode: 'HTML',
            reply_markup: keyboard ? this.buildKeyboard(keyboard) : undefined,
        });
    }

    async answerCallback(): Promise<void> {
        await this.ctx.answerCbQuery();
    }

    private buildKeyboard(buttons: InlineButton[][]) {
        return Markup.inlineKeyboard(
            buttons.map((row) => row.map((btn) => Markup.button.callback(btn.text, btn.action))),
        ).reply_markup;
    }
}
