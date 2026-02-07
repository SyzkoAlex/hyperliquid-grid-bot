import { Inject, Injectable } from '@nestjs/common';
import {
    COMMAND_REGISTRAR,
    CommandRegistrar,
} from '../../../../core/services/command-registrar.service';
import { MessageContext } from '../../../../core/domain/message-context';
import { TelegramAction } from '../../../../core/domain/telegram-command.enum';
import { WelcomeMessage } from '../../../../core/domain/messages/welcome-message';
import { Handler } from '../handler';
import { mainMenuKeyboard } from '../main-menu.keyboard';

@Injectable()
export class MainMenuHandler implements Handler {
    constructor(@Inject(COMMAND_REGISTRAR) private readonly registrar: CommandRegistrar) {}

    register(): void {
        this.registrar.onAction(TelegramAction.MainMenu, (ctx) => this.handle(ctx));
    }

    private async handle(ctx: MessageContext): Promise<void> {
        await ctx.answerCallback();
        await ctx.editMessage(new WelcomeMessage().toString(), mainMenuKeyboard());
    }
}
