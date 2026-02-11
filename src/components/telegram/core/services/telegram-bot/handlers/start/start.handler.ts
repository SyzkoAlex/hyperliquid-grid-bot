import { Injectable } from '@nestjs/common';
import { Markup } from 'telegraf';
import { TelegramBotService } from '../../telegram-bot.service';
import { BotContext } from '../../types/bot-context';
import { TelegramCommand } from '../../../../domain/telegram-command.enum';
import { WelcomeMessage } from '../../../../domain/messages/welcome-message';
import { Handler } from '../handler';
import { mainMenuKeyboard } from '../main-menu.keyboard';

@Injectable()
export class StartHandler implements Handler {
    constructor(private readonly telegramBotService: TelegramBotService) {}

    register(): void {
        this.telegramBotService.onCommand(TelegramCommand.Start, (ctx) => this.handle(ctx));
    }

    private async handle(ctx: BotContext): Promise<void> {
        const keyboard = mainMenuKeyboard();
        const markup = Markup.inlineKeyboard(
            keyboard.map((row) => row.map((btn) => Markup.button.callback(btn.text, btn.action))),
        );
        await ctx.reply(new WelcomeMessage().toString(), markup);
    }
}
