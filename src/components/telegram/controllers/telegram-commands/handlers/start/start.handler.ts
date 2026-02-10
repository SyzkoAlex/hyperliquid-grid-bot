import { Inject, Injectable } from '@nestjs/common';
import { TELEGRAM_SERVICE, TelegramService } from '../../../../core/services/telegram.service';
import { MessageContext } from '../../../../core/domain/message-context';
import { TelegramCommand } from '../../../../core/domain/telegram-command.enum';
import { WelcomeMessage } from '../../../../core/domain/messages/welcome-message';
import { Handler } from '../handler';
import { mainMenuKeyboard } from '../main-menu.keyboard';

@Injectable()
export class StartHandler implements Handler {
    constructor(@Inject(TELEGRAM_SERVICE) private readonly telegramService: TelegramService) {}

    register(): void {
        this.telegramService.onCommand(TelegramCommand.Start, (ctx) => this.handle(ctx));
    }

    private async handle(ctx: MessageContext): Promise<void> {
        await ctx.reply(new WelcomeMessage().toString(), mainMenuKeyboard());
    }
}
