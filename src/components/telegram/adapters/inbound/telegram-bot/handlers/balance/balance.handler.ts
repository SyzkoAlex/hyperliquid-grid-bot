import { Injectable } from '@nestjs/common';
import { TelegramBotService } from '../../telegram-bot.service';
import { BotContext } from '../../types/bot-context';
import { TelegramCommand } from '@components/telegram/core/domain/models/telegram-command';
import { TelegramAction } from '@components/telegram/core/domain/models/telegram-action';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels';
import { BalanceMessage } from '@components/telegram/core/domain/models/messages/balance-message';
import { GetUserBalanceUseCase } from '@components/telegram/core/application/use-cases/get-user-balance/get-user-balance.use-case';
import { Handler } from '../handler';
import { toInlineKeyboard } from '../inline-keyboard';
import { InlineButton } from '@components/telegram/core/domain/models/inline-button';
import { TelegramParseMode } from '@components/telegram/core/domain/models/telegram-parse-mode';
import { UserStatus } from '@domain/models/user/user-status';
import { replyConnectCta } from '../connect-cta.keyboard';

@Injectable()
export class BalanceHandler implements Handler {
    constructor(
        private readonly telegramBotService: TelegramBotService,
        private readonly getBalanceUseCase: GetUserBalanceUseCase,
    ) {}

    register(): void {
        this.telegramBotService.onCommand(TelegramCommand.Balance, (ctx) => this.handle(ctx));
        this.telegramBotService.onAction(TelegramAction.ShowBalance, (ctx) =>
            this.handleAction(ctx),
        );
        this.telegramBotService.onHears(BUTTON_LABELS.BALANCE, (ctx) => this.handle(ctx));
    }

    private async handle(ctx: BotContext): Promise<void> {
        if (ctx.user?.status !== UserStatus.Active) {
            await replyConnectCta(ctx);
            return;
        }
        const view = await this.buildActiveView(ctx.user.accountAddress);
        await ctx.reply(view.text, {
            parse_mode: TelegramParseMode.HTML,
            ...toInlineKeyboard(view.keyboard),
        });
    }

    private async handleAction(ctx: BotContext): Promise<void> {
        await ctx.answerCbQuery();
        if (ctx.user?.status !== UserStatus.Active) {
            await replyConnectCta(ctx);
            return;
        }
        const view = await this.buildActiveView(ctx.user.accountAddress);
        await ctx.editMessageText(view.text, {
            parse_mode: TelegramParseMode.HTML,
            ...toInlineKeyboard(view.keyboard),
        });
    }

    private async buildActiveView(
        accountAddress: string,
    ): Promise<{ text: string; keyboard: InlineButton[][] }> {
        const balance = await this.getBalanceUseCase.execute(accountAddress);
        const text = BalanceMessage.create(balance).text;
        const keyboard: InlineButton[][] = [
            [{ text: BUTTON_LABELS.REFRESH, action: TelegramAction.ShowBalance }],
        ];
        return { text, keyboard };
    }
}
