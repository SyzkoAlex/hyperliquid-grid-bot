import { Inject, Injectable } from '@nestjs/common';
import { TELEGRAM_SERVICE, TelegramService } from '../../../../core/services/telegram.service';
import { MessageContext } from '../../../../core/domain/message-context';
import { TelegramCommand, TelegramAction } from '../../../../core/domain/telegram-command.enum';
import { HelpMessage } from '../../../../core/domain/messages/help-message';
import { Handler } from '../handler';
import { backToMenuKeyboard } from '../main-menu.keyboard';

@Injectable()
export class HelpHandler implements Handler {
    constructor(@Inject(TELEGRAM_SERVICE) private readonly telegramService: TelegramService) {}

    register(): void {
        this.telegramService.onCommand(TelegramCommand.Help, (ctx) => this.handle(ctx));
        this.telegramService.onAction(TelegramAction.ShowHelp, (ctx) => this.handleAction(ctx));
    }

    private async handle(ctx: MessageContext): Promise<void> {
        await ctx.reply(new HelpMessage().toString(), backToMenuKeyboard());
    }

    private async handleAction(ctx: MessageContext): Promise<void> {
        await ctx.answerCallback();
        await ctx.editMessage(new HelpMessage().toString(), backToMenuKeyboard());
    }
}
