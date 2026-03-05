import { Injectable } from '@nestjs/common';
import { TelegramBotService } from '../../telegram-bot.service';
import { BotContext } from '../../types/bot-context';
import { TelegramCommand } from '@components/telegram/core/domain/models/telegram-command';
import { WelcomeMessage } from '@components/telegram/core/domain/models/messages/welcome-message';
import { Handler } from '../handler';
import { replyMenuKeyboard } from '../main-menu.keyboard';

@Injectable()
export class StartHandler implements Handler {
    constructor(private readonly telegramBotService: TelegramBotService) {}

    register(): void {
        this.telegramBotService.onCommand(TelegramCommand.Start, (ctx) => this.handle(ctx));
    }

    private async handle(ctx: BotContext): Promise<void> {
        await ctx.reply(new WelcomeMessage().toString(), {
            parse_mode: 'HTML',
            ...replyMenuKeyboard(),
        });
    }
}
