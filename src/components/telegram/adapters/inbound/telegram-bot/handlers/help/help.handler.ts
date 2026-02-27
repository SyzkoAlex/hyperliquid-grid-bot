import { Injectable } from '@nestjs/common';
import { TelegramBotService } from '../../telegram-bot.service';
import { BotContext } from '../../types/bot-context';
import { TelegramCommand } from '@components/telegram/core/domain/models/telegram-command.enum';
import { TelegramAction } from '@components/telegram/core/domain/models/telegram-action.enum';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels.constants';
import { HelpMessage } from '@components/telegram/core/domain/models/messages/help-message';
import { Handler } from '../handler';
import { backToMenuKeyboard } from '../back-to-menu.keyboard';
import { toInlineKeyboard } from '../inline-keyboard';

@Injectable()
export class HelpHandler implements Handler {
    constructor(private readonly telegramBotService: TelegramBotService) {}

    register(): void {
        this.telegramBotService.onCommand(TelegramCommand.Help, (ctx) => this.handle(ctx));
        this.telegramBotService.onAction(TelegramAction.ShowHelp, (ctx) => this.handleAction(ctx));
        this.telegramBotService.onHears(BUTTON_LABELS.HELP, (ctx) => this.handle(ctx));
    }

    private helpText() {
        return new HelpMessage().toString();
    }

    private helpMarkup() {
        return { parse_mode: 'HTML' as const, ...toInlineKeyboard(backToMenuKeyboard()) };
    }

    private async handle(ctx: BotContext): Promise<void> {
        await ctx.reply(this.helpText(), this.helpMarkup());
    }

    private async handleAction(ctx: BotContext): Promise<void> {
        await ctx.answerCbQuery();
        await ctx.editMessageText(this.helpText(), this.helpMarkup());
    }
}
