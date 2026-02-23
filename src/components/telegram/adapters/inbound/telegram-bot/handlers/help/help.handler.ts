import { Injectable } from '@nestjs/common';
import { TelegramBotService } from '../../telegram-bot.service';
import { BotContext } from '../../types/bot-context';
import {
    TelegramCommand,
    TelegramAction,
} from '@components/telegram/core/domain/models/telegram-command.enum';
import { HelpMessage } from '@components/telegram/core/domain/models/messages/help-message';
import { Handler } from '../handler';
import { backToMenuKeyboard } from '../main-menu.keyboard';
import { toInlineKeyboard } from '../inline-keyboard';

@Injectable()
export class HelpHandler implements Handler {
    constructor(private readonly telegramBotService: TelegramBotService) {}

    register(): void {
        this.telegramBotService.onCommand(TelegramCommand.Help, (ctx) => this.handle(ctx));
        this.telegramBotService.onAction(TelegramAction.ShowHelp, (ctx) => this.handleAction(ctx));
        this.telegramBotService.onHears('❓ Help', (ctx) => this.handle(ctx));
    }

    private async handle(ctx: BotContext): Promise<void> {
        const keyboard = backToMenuKeyboard();
        const markup = toInlineKeyboard(keyboard);
        await ctx.reply(new HelpMessage().toString(), { parse_mode: 'HTML', ...markup });
    }

    private async handleAction(ctx: BotContext): Promise<void> {
        await ctx.answerCbQuery();
        const keyboard = backToMenuKeyboard();
        const markup = toInlineKeyboard(keyboard);
        await ctx.editMessageText(new HelpMessage().toString(), { parse_mode: 'HTML', ...markup });
    }
}
