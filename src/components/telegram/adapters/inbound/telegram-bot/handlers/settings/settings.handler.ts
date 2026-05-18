import { Inject, Injectable } from '@nestjs/common';
import { TelegramBotService } from '../../telegram-bot.service';
import { BotContext } from '../../types/bot-context';
import { TelegramAction } from '@components/telegram/core/domain/models/telegram-action';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels';
import { SettingsMessage } from '@components/telegram/core/domain/models/messages/settings-message';
import { Handler } from '../handler';
import { toInlineKeyboard } from '../inline-keyboard';
import { InlineButton } from '@components/telegram/core/domain/models/inline-button';
import { TelegramParseMode } from '@components/telegram/core/domain/models/telegram-parse-mode';
import { UserStatus } from '@domain/models/user/user-status';
import { replyConnectCta } from '../connect-cta.keyboard';
import { USERS_API_PORT, UsersApiPort } from '@components/users/api/users-api.port';

type SettingsView = { text: string; keyboard: InlineButton[][] };

@Injectable()
export class SettingsHandler implements Handler {
    constructor(
        private readonly telegramBotService: TelegramBotService,
        @Inject(USERS_API_PORT) private readonly usersApi: UsersApiPort,
    ) {}

    register(): void {
        this.telegramBotService.onHears(BUTTON_LABELS.SETTINGS, (ctx) => this.handle(ctx));
        this.telegramBotService.onAction(TelegramAction.ShowSettings, (ctx) =>
            this.handleShow(ctx),
        );
        this.telegramBotService.onAction(TelegramAction.ToggleTradeNotifications, (ctx) =>
            this.handleToggle(ctx),
        );
    }

    private buildView(enabled: boolean): SettingsView {
        const message = SettingsMessage.create(enabled);
        const keyboard: InlineButton[][] = [
            [{ text: message.toggleLabel, action: TelegramAction.ToggleTradeNotifications }],
        ];
        return { text: message.text, keyboard };
    }

    private async handle(ctx: BotContext): Promise<void> {
        if (ctx.user?.status !== UserStatus.Active) {
            await replyConnectCta(ctx);
            return;
        }
        const view = this.buildView(ctx.user.tradeNotificationsEnabled);
        await ctx.reply(view.text, {
            parse_mode: TelegramParseMode.HTML,
            ...toInlineKeyboard(view.keyboard),
        });
    }

    private async handleShow(ctx: BotContext): Promise<void> {
        await ctx.answerCbQuery();
        if (ctx.user?.status !== UserStatus.Active) {
            await replyConnectCta(ctx);
            return;
        }
        const view = this.buildView(ctx.user.tradeNotificationsEnabled);
        await ctx.editMessageText(view.text, {
            parse_mode: TelegramParseMode.HTML,
            ...toInlineKeyboard(view.keyboard),
        });
    }

    private async handleToggle(ctx: BotContext): Promise<void> {
        await ctx.answerCbQuery();
        if (ctx.user?.status !== UserStatus.Active) {
            await replyConnectCta(ctx);
            return;
        }
        const next = !ctx.user.tradeNotificationsEnabled;
        await this.usersApi.updateTradeNotificationsEnabled(ctx.user.id, next);
        ctx.user.tradeNotificationsEnabled = next;
        const view = this.buildView(next);
        await ctx.editMessageText(view.text, {
            parse_mode: TelegramParseMode.HTML,
            ...toInlineKeyboard(view.keyboard),
        });
    }
}
