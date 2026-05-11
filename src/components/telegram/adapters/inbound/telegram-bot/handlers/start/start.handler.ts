import { Injectable } from '@nestjs/common';
import { Markup } from 'telegraf';
import { TelegramBotService } from '../../telegram-bot.service';
import { BotContext } from '../../types/bot-context';
import { TelegramCommand } from '@components/telegram/core/domain/models/telegram-command';
import { WelcomeMessage } from '@components/telegram/core/domain/models/messages/welcome-message';
import { LandingMessage } from '@components/telegram/core/domain/models/messages/landing-message';
import { Handler } from '../handler';
import { replyMenuKeyboard } from '../main-menu.keyboard';
import { toInlineKeyboard } from '../inline-keyboard';
import { connectCtaKeyboard } from '../connect-cta.keyboard';
import { TelegramParseMode } from '@components/telegram/core/domain/models/telegram-parse-mode';
import { UserStatus } from '@domain/models/user/user-status';
import { enterConnectAccountScene } from '../enter-connect-account-scene';

@Injectable()
export class StartHandler implements Handler {
    constructor(private readonly telegramBotService: TelegramBotService) {}

    register(): void {
        this.telegramBotService.onCommand(TelegramCommand.Start, (ctx) => this.handle(ctx));
    }

    private async handle(ctx: BotContext): Promise<void> {
        // ctx.user is set by auth middleware for registered users
        if (ctx.user?.status === UserStatus.Active) {
            await ctx.reply(WelcomeMessage.create().text, {
                parse_mode: TelegramParseMode.HTML,
                ...replyMenuKeyboard(),
            });
            return;
        }

        if (ctx.user?.status === UserStatus.PendingApproval) {
            // Resume in-flight onboarding.
            await enterConnectAccountScene(ctx, ctx.user);
            return;
        }

        // Unregistered or Disconnected — show the landing.
        // Two separate sends: first remove any persistent reply keyboard, then
        // send the landing message with the inline CTA button.  A single send
        // cannot do both because the second spread would overwrite reply_markup.
        await ctx.reply('​', Markup.removeKeyboard()); // keyboard-flush: removes any persistent reply keyboard
        await ctx.reply(LandingMessage.create().text, {
            parse_mode: TelegramParseMode.HTML,
            ...toInlineKeyboard(connectCtaKeyboard()),
        });
    }
}
