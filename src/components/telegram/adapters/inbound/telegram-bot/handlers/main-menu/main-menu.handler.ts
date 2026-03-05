import { Injectable } from '@nestjs/common';
import { TelegramBotService } from '../../telegram-bot.service';
import { BotContext } from '../../types/bot-context';
import { TelegramAction } from '@components/telegram/core/domain/models/telegram-action';
import { WelcomeMessage } from '@components/telegram/core/domain/models/messages/welcome-message';
import { Handler } from '../handler';
import { mainMenuKeyboard } from '../main-menu.keyboard';
import { toInlineKeyboard } from '../inline-keyboard';

@Injectable()
export class MainMenuHandler implements Handler {
    constructor(private readonly telegramBotService: TelegramBotService) {}

    register(): void {
        this.telegramBotService.onAction(TelegramAction.MainMenu, (ctx) => this.handle(ctx));
    }

    private async handle(ctx: BotContext): Promise<void> {
        await ctx.answerCbQuery();
        const keyboard = mainMenuKeyboard();
        const markup = toInlineKeyboard(keyboard);
        await ctx.editMessageText(new WelcomeMessage().toString(), {
            parse_mode: 'HTML',
            ...markup,
        });
    }
}
