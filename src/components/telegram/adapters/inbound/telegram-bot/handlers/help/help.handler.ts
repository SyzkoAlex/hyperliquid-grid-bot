import { Injectable } from '@nestjs/common';
import { TelegramBotService } from '../../telegram-bot.service';
import { BotContext } from '../../types/bot-context';
import { TelegramCommand } from '@components/telegram/core/domain/models/telegram-command';
import { TelegramAction } from '@components/telegram/core/domain/models/telegram-action';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels';
import { HelpMessage } from '@components/telegram/core/domain/models/messages/help-message';
import { Handler } from '../handler';
import { TelegramParseMode } from '@components/telegram/core/domain/models/telegram-parse-mode';

@Injectable()
export class HelpHandler implements Handler {
    constructor(private readonly telegramBotService: TelegramBotService) {}

    register(): void {
        this.telegramBotService.onCommand(TelegramCommand.Help, (ctx) => this.handle(ctx));
        this.telegramBotService.onAction(TelegramAction.ShowHelp, (ctx) => this.handleAction(ctx));
        this.telegramBotService.onHears(BUTTON_LABELS.HELP, (ctx) => this.handle(ctx));
    }

    private async handle(ctx: BotContext): Promise<void> {
        await ctx.reply(HelpMessage.create().text, { parse_mode: TelegramParseMode.HTML });
    }

    private async handleAction(ctx: BotContext): Promise<void> {
        await ctx.answerCbQuery();
        await ctx.editMessageText(HelpMessage.create().text, {
            parse_mode: TelegramParseMode.HTML,
        });
    }
}
