import { Injectable } from '@nestjs/common';
import { TelegramBotService } from '../../telegram-bot.service';
import { BotContext } from '../../types/bot-context';
import {
    GridAction,
    TelegramAction,
} from '@components/telegram/domain/models/telegram-command.enum';
import { Handler } from '../handler';
import { GetGridWithPnlUseCase } from '@components/telegram/application/use-cases/get-grid-with-pnl/get-grid-with-pnl.use-case';
import { StopGridUseCase } from '@components/telegram/application/use-cases/stop-grid/stop-grid.use-case';
import { GridListItemMessage } from '@components/telegram/domain/models/messages/grid-list-item.message';
import { GridWithPnl } from '@components/telegram/application/use-cases/get-grids-with-pnl/grid-with-pnl';
import { GridId } from '@domain/models/grid/grid-id';
import { InlineButton } from '@components/telegram/domain/models/inline-button';
import { EMOJI } from '@components/telegram/domain/models/constants/emoji.constants';
import { toInlineKeyboard } from '../inline-keyboard';
import { logger } from '@infra/logger/logger';

@Injectable()
export class GridViewHandler implements Handler {
    private readonly logger = logger.child({ context: GridViewHandler.name });

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
        const markup = this.buildDetailKeyboard(gridId);
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

        const pair = `${item.grid.symbol.toString()}/USDC`;
        const text =
            `${EMOJI.WARNING} <b>Stop grid?</b>\n\n` +
            `Are you sure you want to stop the <b>${pair}</b> grid?\n` +
            `All open orders will be cancelled.`;

        const buttons: InlineButton[][] = [
            [
                { text: `${EMOJI.SUCCESS} Yes, stop`, action: GridAction.confirmStop(gridId) },
                { text: `${EMOJI.CANCEL} Cancel`, action: GridAction.cancelStop(gridId) },
            ],
        ];

        await ctx.reply(text, { parse_mode: 'HTML', ...toInlineKeyboard(buttons) });
    }

    private async handleConfirmStop(ctx: BotContext): Promise<void> {
        await ctx.answerCbQuery();
        const gridId = ctx.match![1];

        try {
            await this.stopGridUseCase.execute(gridId);
            await ctx.editMessageText(`${EMOJI.SUCCESS} Grid stopped successfully.`, {
                parse_mode: 'HTML',
            });
        } catch (error) {
            this.logger.error({ error, gridId }, 'Failed to stop grid');
            await ctx.editMessageText(`${EMOJI.ERROR} Failed to stop grid. Please try again.`, {
                parse_mode: 'HTML',
            });
        }
    }

    private async handleCancelStop(ctx: BotContext): Promise<void> {
        await ctx.answerCbQuery();
        await ctx.deleteMessage();
    }

    private async fetchGrid(ctx: BotContext, gridId: string): Promise<GridWithPnl | null> {
        try {
            const id = GridId.from(gridId);
            const item = await this.getGridWithPnlUseCase.execute(id);
            if (!item) {
                await ctx.reply(`${EMOJI.WARNING} Grid not found.`, { parse_mode: 'HTML' });
                return null;
            }
            return item;
        } catch (error) {
            this.logger.error({ error, gridId }, 'Failed to fetch grid');
            await ctx.reply(`${EMOJI.ERROR} Failed to load grid data.`, { parse_mode: 'HTML' });
            return null;
        }
    }

    private buildDetailKeyboard(gridId: string) {
        const buttons: InlineButton[][] = [
            [
                { text: `${EMOJI.CLIPBOARD} Orders`, action: GridAction.ordersTab(gridId) },
                { text: `📜 History`, action: GridAction.historyTab(gridId) },
            ],
            [
                { text: `${EMOJI.RED_CIRCLE} Stop`, action: GridAction.stop(gridId) },
                { text: `${EMOJI.BACK} Back to List`, action: TelegramAction.ListGrids },
            ],
        ];
        return toInlineKeyboard(buttons);
    }

    private buildSubTabKeyboard(gridId: string) {
        const buttons: InlineButton[][] = [
            [{ text: `${EMOJI.BACK} Back`, action: GridAction.view(gridId) }],
        ];
        return toInlineKeyboard(buttons);
    }
}
