import { Inject, Injectable } from '@nestjs/common';
import { TelegramBotService } from '../../telegram-bot.service';
import { BotContext } from '../../types/bot-context';
import { TelegramCommand } from '@components/telegram/core/domain/models/telegram-command';
import { WelcomeMessage } from '@components/telegram/core/domain/models/messages/welcome-message';
import { Handler } from '../handler';
import { replyMenuKeyboard } from '../main-menu.keyboard';
import { TelegramParseMode } from '@components/telegram/core/domain/models/telegram-parse-mode';
import { USERS_API_PORT, UsersApiPort } from '@components/users/api/users-api.port';
import { UserStatus } from '@domain/models/user/user-status';
import { CONNECT_ACCOUNT_SCENE_ID } from '../../scenes/connect-account/connect-account.scene';

@Injectable()
export class StartHandler implements Handler {
    constructor(
        private readonly telegramBotService: TelegramBotService,
        @Inject(USERS_API_PORT) private readonly usersApi: UsersApiPort,
    ) {}

    register(): void {
        this.telegramBotService.onCommand(TelegramCommand.Start, (ctx) => this.handle(ctx));
    }

    private async handle(ctx: BotContext): Promise<void> {
        const chatId = ctx.chat?.id;
        if (!chatId) return;

        const user = await this.usersApi.findUserByChatId(chatId);

        if (!user || user.status === UserStatus.Disconnected) {
            // New user or disconnected — start onboarding
            await ctx.scene.enter(CONNECT_ACCOUNT_SCENE_ID);
            return;
        }

        if (user.status === UserStatus.PendingApproval) {
            // Resume from approve step
            ctx.session.connectAccount = {
                accountAddress: user.accountAddress,
                userId: user.id,
                agentAddress: user.agentAddress,
            };
            await ctx.scene.enter(CONNECT_ACCOUNT_SCENE_ID);
            return;
        }

        // Active user — show normal welcome
        await ctx.reply(WelcomeMessage.create().text, {
            parse_mode: TelegramParseMode.HTML,
            ...replyMenuKeyboard(),
        });
    }
}
