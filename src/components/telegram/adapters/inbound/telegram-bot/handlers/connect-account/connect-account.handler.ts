import { Injectable } from '@nestjs/common';
import { TelegramBotService } from '../../telegram-bot.service';
import { BotContext } from '../../types/bot-context';
import { TelegramAction } from '@components/telegram/core/domain/models/telegram-action';
import { Handler } from '../handler';
import { UserStatus } from '@domain/models/user/user-status';
import { enterConnectAccountScene } from '../enter-connect-account-scene';
import { CONNECT_ACCOUNT_SCENE_ID } from '../../scenes/connect-account/connect-account.scene';

@Injectable()
export class ConnectAccountHandler implements Handler {
    constructor(private readonly telegramBotService: TelegramBotService) {}

    register(): void {
        this.telegramBotService.onAction(TelegramAction.ConnectAccount, (ctx) => this.handle(ctx));
    }

    private async handle(ctx: BotContext): Promise<void> {
        await ctx.answerCbQuery();

        // PendingApproval users have a half-completed connection — pre-populate the session
        // so the scene resumes at ApproveAgent. ctx.user is set by auth middleware.
        if (ctx.user?.status === UserStatus.PendingApproval) {
            await enterConnectAccountScene(ctx, ctx.user);
            return;
        }
        await ctx.scene.enter(CONNECT_ACCOUNT_SCENE_ID);
    }
}
