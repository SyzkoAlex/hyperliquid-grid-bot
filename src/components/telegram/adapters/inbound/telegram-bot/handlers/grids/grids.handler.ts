import { Injectable } from '@nestjs/common';
import { TelegramBotService } from '../../telegram-bot.service';
import { BotContext } from '../../types/bot-context';
import { TelegramCommand } from '@components/telegram/core/domain/models/telegram-command';
import { TelegramAction } from '@components/telegram/core/domain/models/telegram-action';
import { GridsAction } from '@components/telegram/core/domain/models/grids-action';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels';
import { Handler } from '../handler';
import { GetGridsWithPnlUseCase } from '@components/telegram/core/application/use-cases/get-grids-with-pnl/get-grids-with-pnl.use-case';
import { GridFilter } from '@components/telegram/core/application/use-cases/get-grids-with-pnl/grid-filter';
import { GridsListMessages } from '@components/telegram/core/domain/models/messages/grids-list.messages';
import { toInlineKeyboard } from '../inline-keyboard';
import { GridsListView } from './grids-list.view';

const ACTIVE_PAGE_SIZE = 4;
const STOPPED_PAGE_SIZE = 5;

@Injectable()
export class GridsHandler implements Handler {
    constructor(
        private readonly telegramBotService: TelegramBotService,
        private readonly getGridsWithPnlUseCase: GetGridsWithPnlUseCase,
    ) {}

    register(): void {
        this.telegramBotService.onCommand(TelegramCommand.Grids, (ctx) => this.sendActiveList(ctx));
        this.telegramBotService.onHears(BUTTON_LABELS.GRIDS, (ctx) => this.sendActiveList(ctx));
        this.telegramBotService.onHears(BUTTON_LABELS.STOPPED_GRIDS, (ctx) =>
            this.sendStoppedList(ctx),
        );
        this.telegramBotService.onAction(TelegramAction.ListGrids, (ctx) =>
            this.editActiveList(ctx, 1),
        );
        this.telegramBotService.onAction(GridsAction.ACTIVE_PAGE_PATTERN, (ctx) =>
            this.editActiveList(ctx, parseInt(ctx.match![1], 10)),
        );
        this.telegramBotService.onAction(GridsAction.STOPPED_PAGE_PATTERN, (ctx) =>
            this.editStoppedList(ctx, parseInt(ctx.match![1], 10)),
        );
    }

    private async sendActiveList(ctx: BotContext): Promise<void> {
        const view = await this.buildActiveView(1);
        await ctx.reply(view.text, { parse_mode: 'HTML', ...toInlineKeyboard(view.keyboard) });
    }

    private async editActiveList(ctx: BotContext, page: number): Promise<void> {
        await ctx.answerCbQuery();
        const view = await this.buildActiveView(page);
        await ctx.editMessageText(view.text, {
            parse_mode: 'HTML',
            ...toInlineKeyboard(view.keyboard),
        });
    }

    private async sendStoppedList(ctx: BotContext): Promise<void> {
        const view = await this.buildStoppedView(1);
        await ctx.reply(view.text, { parse_mode: 'HTML', ...toInlineKeyboard(view.keyboard) });
    }

    private async editStoppedList(ctx: BotContext, page: number): Promise<void> {
        await ctx.answerCbQuery();
        const view = await this.buildStoppedView(page);
        await ctx.editMessageText(view.text, {
            parse_mode: 'HTML',
            ...toInlineKeyboard(view.keyboard),
        });
    }

    private async buildActiveView(page: number) {
        const items = await this.getGridsWithPnlUseCase.execute(GridFilter.Running);
        const paged = GridsListView.paginate(items, page, ACTIVE_PAGE_SIZE);
        const header = GridsListMessages.activeHeader(items.length, paged.page, paged.totalPages);
        return GridsListView.build(
            header,
            paged.items,
            paged.startIndex,
            GridsAction.activePage,
            paged.page,
            paged.totalPages,
        );
    }

    private async buildStoppedView(page: number) {
        const items = await this.getGridsWithPnlUseCase.execute(GridFilter.Stopped);
        const paged = GridsListView.paginate(items, page, STOPPED_PAGE_SIZE);
        const header = GridsListMessages.stoppedHeader(paged.page, paged.totalPages, items.length);
        return GridsListView.build(
            header,
            paged.items,
            paged.startIndex,
            GridsAction.stoppedPage,
            paged.page,
            paged.totalPages,
        );
    }
}
