import { Injectable } from '@nestjs/common';
import { TelegramBotService } from '../../telegram-bot.service';
import { BotContext } from '../../types/bot-context';
import { GridAction } from '@components/telegram/core/domain/models/grid-action';
import { GetGridWithPnlUseCase } from '@components/telegram/core/application/use-cases/get-grid-with-pnl/get-grid-with-pnl.use-case';
import { StopGridUseCase } from '@components/telegram/core/application/use-cases/stop-grid/stop-grid.use-case';
import { GridViewTexts } from '@components/telegram/core/domain/models/messages/grid-view/grid-view.texts';
import { StopConfirmationMessage } from '@components/telegram/core/domain/models/messages/grid-view/stop-confirmation-message';
import { toInlineKeyboard } from '../inline-keyboard';
import { TelegramParseMode } from '@components/telegram/core/domain/models/telegram-parse-mode';
import { GridViewBaseHandler } from './grid-view-base.handler';
import { CancelStopButton, ConfirmStopButton } from './grid-view.buttons';

@Injectable()
export class StopGridHandler extends GridViewBaseHandler {
    private readonly stoppingGrids = new Set<string>();

    constructor(
        private readonly telegramBotService: TelegramBotService,
        getGridWithPnlUseCase: GetGridWithPnlUseCase,
        private readonly stopGridUseCase: StopGridUseCase,
    ) {
        super(getGridWithPnlUseCase);
    }

    register(): void {
        this.telegramBotService.onAction(GridAction.STOP_PATTERN, (ctx) =>
            this.handleStopRequest(ctx),
        );
        this.telegramBotService.onAction(GridAction.CONFIRM_STOP_PATTERN, (ctx) =>
            this.handleConfirmStop(ctx),
        );
        this.telegramBotService.onAction(GridAction.CANCEL_STOP_PATTERN, (ctx) =>
            this.handleCancelStop(ctx),
        );
    }

    private async handleStopRequest(ctx: BotContext): Promise<void> {
        try {
            const gridId = ctx.match![1];

            const snapshot = await this.fetchGridSnapshot(ctx, gridId);
            if (!snapshot) return;

            const { symbol, id, lowerPrice, upperPrice } = snapshot.grid;
            const text = StopConfirmationMessage.create({
                symbol,
                id,
                lowerPrice,
                upperPrice,
            }).text;

            const buttons = [[ConfirmStopButton.create(gridId), CancelStopButton.create(gridId)]];

            await ctx.reply(text, {
                parse_mode: TelegramParseMode.HTML,
                ...toInlineKeyboard(buttons),
            });
        } finally {
            await ctx.answerCbQuery();
        }
    }

    private async handleConfirmStop(ctx: BotContext): Promise<void> {
        const gridId = ctx.match![1];

        if (this.stoppingGrids.has(gridId)) {
            await ctx.answerCbQuery('Grid is already being stopped...');
            return;
        }

        try {
            this.stoppingGrids.add(gridId);
            await this.executeStop(ctx, gridId);
        } finally {
            await ctx.answerCbQuery();
        }
    }

    private async executeStop(ctx: BotContext, gridId: string): Promise<void> {
        await ctx.editMessageText(GridViewTexts.STOPPING, { parse_mode: TelegramParseMode.HTML });

        try {
            await this.stopGridUseCase.execute(gridId);
            await ctx.editMessageText(GridViewTexts.STOPPED_SUCCESS, {
                parse_mode: TelegramParseMode.HTML,
            });
        } catch (error) {
            this.logger.error({ error, gridId }, 'Failed to stop grid');
            await ctx.editMessageText(GridViewTexts.STOPPED_ERROR, {
                parse_mode: TelegramParseMode.HTML,
            });
        } finally {
            this.stoppingGrids.delete(gridId);
        }
    }

    private async handleCancelStop(ctx: BotContext): Promise<void> {
        await ctx.answerCbQuery();
        await ctx.deleteMessage();
    }
}
