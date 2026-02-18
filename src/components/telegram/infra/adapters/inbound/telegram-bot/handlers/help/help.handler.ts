import { Injectable } from '@nestjs/common';
import { Markup } from 'telegraf';
import { TelegramBotService } from '../../telegram-bot.service';
import { BotContext } from '../../types/bot-context';
import {
    TelegramCommand,
    TelegramAction,
} from '@components/telegram/domain/models/telegram-command.enum';
import { HelpMessage } from '@components/telegram/domain/models/messages/help-message';
import { Handler } from '../handler';
import { backToMenuKeyboard } from '../main-menu.keyboard';

@Injectable()
export class HelpHandler implements Handler {
    constructor(private readonly telegramBotService: TelegramBotService) {}

    register(): void {
        this.telegramBotService.onCommand(TelegramCommand.Help, (ctx) => this.handle(ctx));
        this.telegramBotService.onAction(TelegramAction.ShowHelp, (ctx) => this.handleAction(ctx));
    }

    private async handle(ctx: BotContext): Promise<void> {
        const keyboard = backToMenuKeyboard();
        const markup = Markup.inlineKeyboard(
            keyboard.map((row) => row.map((btn) => Markup.button.callback(btn.text, btn.action))),
        );
        await ctx.reply(new HelpMessage().toString(), markup);
    }

    private async handleAction(ctx: BotContext): Promise<void> {
        await ctx.answerCbQuery();
        const keyboard = backToMenuKeyboard();
        const markup = Markup.inlineKeyboard(
            keyboard.map((row) => row.map((btn) => Markup.button.callback(btn.text, btn.action))),
        );
        await ctx.editMessageText(new HelpMessage().toString(), markup);
    }
}
