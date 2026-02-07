import { Inject, Injectable } from '@nestjs/common';
import {
    COMMAND_REGISTRAR,
    CommandRegistrar,
} from '../../../../core/services/command-registrar.service';
import { MessageContext } from '../../../../core/domain/message-context';
import { TelegramCommand, TelegramAction } from '../../../../core/domain/telegram-command.enum';
import { HelpMessage } from '../../../../core/domain/messages/help-message';
import { Handler } from '../handler';
import { backToMenuKeyboard } from '../main-menu.keyboard';

@Injectable()
export class HelpHandler implements Handler {
    constructor(@Inject(COMMAND_REGISTRAR) private readonly registrar: CommandRegistrar) {}

    register(): void {
        this.registrar.onCommand(TelegramCommand.Help, (ctx) => this.handle(ctx));
        this.registrar.onAction(TelegramAction.ShowHelp, (ctx) => this.handleAction(ctx));
    }

    private async handle(ctx: MessageContext): Promise<void> {
        await ctx.reply(new HelpMessage().toString(), backToMenuKeyboard());
    }

    private async handleAction(ctx: MessageContext): Promise<void> {
        await ctx.answerCallback();
        await ctx.editMessage(new HelpMessage().toString(), backToMenuKeyboard());
    }
}
