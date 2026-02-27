import { Injectable } from '@nestjs/common';
import { TelegramBotService } from '../../telegram-bot.service';
import { BotContext } from '../../types/bot-context';
import { TelegramAction } from '@components/telegram/core/domain/models/telegram-action.enum';
import { GridAction } from '@components/telegram/core/domain/models/grid-action';
import { GridsAction } from '@components/telegram/core/domain/models/grids-action';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels.constants';
import { Handler } from '../handler';
import { GetGridWithPnlUseCase } from '@components/telegram/core/application/use-cases/get-grid-with-pnl/get-grid-with-pnl.use-case';
import { StopGridUseCase } from '@components/telegram/core/application/use-cases/stop-grid/stop-grid.use-case';
import { GridListItemMessage } from '../../messages/grid-list-item.message';
import { GridViewMessages } from '@components/telegram/core/domain/models/messages/grid-view.messages';
import { GridWithPnl } from '@components/telegram/core/application/use-cases/get-grids-with-pnl/grid-with-pnl';
import { InlineButton } from '@components/telegram/core/domain/models/inline-button';
import { toInlineKeyboard } from '../inline-keyboard';
import { GridStatus } from '@domain/models/grid/grid-status';
import { logger } from '@/infra/logger/logger';

@Injectable()
export class GridViewHandler implements Handler {
    private readonly logger = logger.child({ context: GridViewHandler.name });
    private readonly stoppingGrids = new Set<string>();

    constructor(
        private readonly telegramBotService: TelegramBotService,
        private readonly getGridWithPnlUseCase: GetGridWithPnlUseCase,
        private readonly stopGridUseCase: StopGridUseCase,
    ) {}

    register(): void {
        this.telegramBotService.onAction(GridAction.VIEW_PATTERN, (ctx) => this.handleView(ctx));
        this.telegramBotService.onAction(GridAction.VIEW_ORDERS_PATTERN, (ctx) =>
            this.handleOrdersTab(ctx),
        );
        this.telegramBotService.onAction(GridAction.VIEW_HISTORY_PATTERN, (ctx) =>
            this.handleHistoryTab(ctx),
        );
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

    private async handleView(ctx: BotContext): Promise<void> {
        await ctx.answerCbQuery();
        const gridId = ctx.match![1];

        const item = await this.fetchGrid(ctx, gridId);
        if (!item) return;

        const text = GridListItemMessage.profitTab(item);
        const markup = this.buildDetailKeyboard(gridId, item.grid.status);
        await ctx.editMessageText(text, { parse_mode: 'HTML', ...markup });
    }

    private async handleOrdersTab(ctx: BotContext): Promise<void> {
        await ctx.answerCbQuery();
        const gridId = ctx.match![1];

        const item = await this.fetchGrid(ctx, gridId);
        if (!item) return;

        const text = GridListItemMessage.ordersTab(item);
        const markup = this.buildSubTabKeyboard(gridId);
        await ctx.editMessageText(text, { parse_mode: 'HTML', ...markup });
    }

    private async handleHistoryTab(ctx: BotContext): Promise<void> {
        await ctx.answerCbQuery();
        const gridId = ctx.match![1];

        const item = await this.fetchGrid(ctx, gridId);
        if (!item) return;

        const text = GridListItemMessage.historyTab(item);
        const markup = this.buildSubTabKeyboard(gridId);
        await ctx.editMessageText(text, { parse_mode: 'HTML', ...markup });
    }

    private async handleStopRequest(ctx: BotContext): Promise<void> {
        await ctx.answerCbQuery();
        const gridId = ctx.match![1];

        const item = await this.fetchGrid(ctx, gridId);
        if (!item) return;

        const { symbol, id, lowerPrice, upperPrice } = item.grid;
        const text = GridViewMessages.stopConfirmation(symbol, id, lowerPrice, upperPrice);

        const buttons: InlineButton[][] = [
            [
                { text: BUTTON_LABELS.YES_STOP, action: GridAction.confirmStop(gridId) },
                { text: BUTTON_LABELS.CANCEL, action: GridAction.cancelStop(gridId) },
            ],
        ];

        await ctx.reply(text, { parse_mode: 'HTML', ...toInlineKeyboard(buttons) });
    }

    private async handleConfirmStop(ctx: BotContext): Promise<void> {
        const gridId = ctx.match![1];

        if (this.stoppingGrids.has(gridId)) {
            await ctx.answerCbQuery('Grid is already being stopped...');
            return;
        }

        this.stoppingGrids.add(gridId);
        await ctx.answerCbQuery();

        await ctx.editMessageText(GridViewMessages.STOPPING, { parse_mode: 'HTML' });

        const backKeyboard = toInlineKeyboard([
            [{ text: BUTTON_LABELS.BACK, action: TelegramAction.ListGrids }],
        ]);

        try {
            await this.stopGridUseCase.execute(gridId);
            await ctx.editMessageText(GridViewMessages.STOPPED_SUCCESS, {
                parse_mode: 'HTML',
                ...backKeyboard,
            });
        } catch (error) {
            this.logger.error({ error, gridId }, 'Failed to stop grid');
            await ctx.editMessageText(GridViewMessages.STOPPED_ERROR, {
                parse_mode: 'HTML',
                ...backKeyboard,
            });
        } finally {
            this.stoppingGrids.delete(gridId);
        }
    }

    private async handleCancelStop(ctx: BotContext): Promise<void> {
        await ctx.answerCbQuery();
        await ctx.deleteMessage();
    }

    private async fetchGrid(ctx: BotContext, gridId: string): Promise<GridWithPnl | null> {
        try {
            const item = await this.getGridWithPnlUseCase.execute(gridId);
            if (!item) {
                await ctx.reply(GridViewMessages.NOT_FOUND, { parse_mode: 'HTML' });
                return null;
            }
            return item;
        } catch (error) {
            this.logger.error({ error, gridId }, 'Failed to fetch grid');
            await ctx.reply(GridViewMessages.LOAD_ERROR, { parse_mode: 'HTML' });
            return null;
        }
    }

    private buildDetailKeyboard(gridId: string, status: GridStatus) {
        const topRow: InlineButton[] = [];
        if (status === GridStatus.Running) {
            topRow.push({ text: BUTTON_LABELS.ORDERS, action: GridAction.ordersTab(gridId) });
        }
        topRow.push({ text: BUTTON_LABELS.HISTORY, action: GridAction.historyTab(gridId) });

        const buttons: InlineButton[][] = [topRow];

        const backAction =
            status === GridStatus.Stopped ? GridsAction.stoppedPage(1) : TelegramAction.ListGrids;

        const bottomRow: InlineButton[] = [];
        if (status === GridStatus.Running) {
            bottomRow.push({ text: BUTTON_LABELS.STOP, action: GridAction.stop(gridId) });
        }
        bottomRow.push({ text: BUTTON_LABELS.BACK, action: backAction });
        buttons.push(bottomRow);

        return toInlineKeyboard(buttons);
    }

    private buildSubTabKeyboard(gridId: string) {
        const buttons: InlineButton[][] = [
            [{ text: BUTTON_LABELS.BACK, action: GridAction.view(gridId) }],
        ];
        return toInlineKeyboard(buttons);
    }
}
