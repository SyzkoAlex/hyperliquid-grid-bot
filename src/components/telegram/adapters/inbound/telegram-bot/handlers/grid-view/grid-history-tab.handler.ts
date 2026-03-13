import { Injectable } from '@nestjs/common';
import { TelegramBotService } from '../../telegram-bot.service';
import { BotContext } from '../../types/bot-context';
import { GridAction } from '@components/telegram/core/domain/models/grid-action';
import { GetGridWithPnlUseCase } from '@components/telegram/core/application/use-cases/get-grid-with-pnl/get-grid-with-pnl.use-case';
import { GridHistoryTabMessage } from '@components/telegram/core/domain/models/messages/grid-view/grid-history-tab.message';
import { TelegramParseMode } from '@components/telegram/core/domain/models/telegram-parse-mode';
import { GridViewBaseHandler } from './grid-view-base.handler';

@Injectable()
export class GridHistoryTabHandler extends GridViewBaseHandler {
    constructor(
        private readonly telegramBotService: TelegramBotService,
        getGridWithPnlUseCase: GetGridWithPnlUseCase,
    ) {
        super(getGridWithPnlUseCase);
    }

    register(): void {
        this.telegramBotService.onAction(GridAction.VIEW_HISTORY_PATTERN, (ctx) =>
            this.handle(ctx),
        );
    }

    private async handle(ctx: BotContext): Promise<void> {
        try {
            const gridId = ctx.match![1];
            const page = parseInt(ctx.match![2], 10);

            const snapshot = await this.fetchGridSnapshot(ctx, gridId);
            if (!snapshot) return;

            const text = GridHistoryTabMessage.create(snapshot).text;
            const markup = this.buildSubTabKeyboard(gridId, page);
            await ctx.editMessageText(text, { parse_mode: TelegramParseMode.HTML, ...markup });
        } finally {
            await ctx.answerCbQuery();
        }
    }
}
