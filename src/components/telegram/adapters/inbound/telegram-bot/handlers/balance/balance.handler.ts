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
        const view = await this.buildView();
        await ctx.reply(view.text, { parse_mode: 'HTML', ...toInlineKeyboard(view.keyboard) });
    }

    private async handleAction(ctx: BotContext): Promise<void> {
        await ctx.answerCbQuery();
        const view = await this.buildView();
        await ctx.editMessageText(view.text, {
            parse_mode: 'HTML',
            ...toInlineKeyboard(view.keyboard),
        });
    }

    private async buildView(): Promise<{ text: string; keyboard: InlineButton[][] }> {
        const balance = await this.getBalanceUseCase.execute();
        const text = new BalanceMessage(balance).toString();
        const keyboard: InlineButton[][] = [
            [{ text: '🔄 Refresh', action: TelegramAction.ShowBalance }],
        ];
        return { text, keyboard };
    }
}
