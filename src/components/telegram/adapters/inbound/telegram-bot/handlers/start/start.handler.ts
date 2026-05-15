import { Injectable } from '@nestjs/common';
import { Markup } from 'telegraf';
import { TelegramBotService } from '../../telegram-bot.service';
import { BotContext } from '../../types/bot-context';
import { TelegramCommand } from '@components/telegram/core/domain/models/telegram-command';
import { LandingMessage } from '@components/telegram/core/domain/models/messages/landing-message';
import { EmptyGridsMessage } from '@components/telegram/core/domain/models/messages/empty-grids-message';
import { Handler } from '../handler';
import { replyMenuKeyboard } from '../main-menu.keyboard';
import { toInlineKeyboard } from '../inline-keyboard';
import { connectCtaKeyboard } from '../connect-cta.keyboard';
import { TelegramParseMode } from '@components/telegram/core/domain/models/telegram-parse-mode';
import { UserStatus } from '@domain/models/user/user-status';
import { enterConnectAccountScene } from '../enter-connect-account-scene';
import { ActiveGridsViewBuilder } from '@components/telegram/core/application/services/active-grids-view-builder/active-grids-view-builder.service';

@Injectable()
export class StartHandler implements Handler {
    constructor(
        private readonly telegramBotService: TelegramBotService,
        private readonly viewBuilder: ActiveGridsViewBuilder,
    ) {}

    register(): void {
        this.telegramBotService.onCommand(TelegramCommand.Start, (ctx) => this.handle(ctx));
    }

    private async handle(ctx: BotContext): Promise<void> {
        if (ctx.user?.status === UserStatus.PendingApproval) {
            await enterConnectAccountScene(ctx, ctx.user);
            return;
        }

        if (!ctx.user || ctx.user.status === UserStatus.Disconnected) {
            await this.replyLanding(ctx);
            return;
        }

        // Active user
        const username = ctx.from?.username;
        const view = await this.viewBuilder.buildWithGreeting(1, username);

        if (view.totalCount === 0) {
            await ctx.reply(EmptyGridsMessage.create({ username }).text, {
                parse_mode: TelegramParseMode.HTML,
                ...replyMenuKeyboard(),
            });
            return;
        }

        await ctx.reply(view.text, {
            parse_mode: TelegramParseMode.HTML,
            ...toInlineKeyboard(view.keyboard),
        });
    }

    private async replyLanding(ctx: BotContext): Promise<void> {
        // keyboard-flush: removes any persistent reply keyboard before showing landing
        const { message_id } = await ctx.reply('.', Markup.removeKeyboard());
        await ctx.deleteMessage(message_id);
        await ctx.reply(LandingMessage.create().text, {
            parse_mode: TelegramParseMode.HTML,
            ...toInlineKeyboard(connectCtaKeyboard()),
        });
    }
}
