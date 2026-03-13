import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Config } from '@/config/config.schema';
import { TelegramBotService } from '../../telegram-bot.service';
import { BotContext } from '../../types/bot-context';
import { TelegramCommand } from '@components/telegram/core/domain/models/telegram-command';
import { TelegramAction } from '@components/telegram/core/domain/models/telegram-action';
import { GridsAction } from '@components/telegram/core/domain/models/grids-action';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels';
import { Handler } from '../handler';
import { GetGridsWithPnlUseCase } from '@components/telegram/core/application/use-cases/get-grids-with-pnl/get-grids-with-pnl.use-case';
import { GridFilter } from '@components/telegram/core/application/use-cases/get-grids-with-pnl/grid-filter';
import {
    ActiveGridsHeaderMessage,
    StoppedGridsHeaderMessage,
} from '@components/telegram/core/domain/models/messages/grids/grids-list.messages';
import { GridListMessage } from '@components/telegram/core/domain/models/messages/grids/grid-list.message';
import { toInlineKeyboard } from '../inline-keyboard';
import { GridsListKeyboard } from './grids-list.keyboard';
import { TelegramParseMode } from '@components/telegram/core/domain/models/telegram-parse-mode';

@Injectable()
export class GridsHandler implements Handler {
    private readonly activePageSize: number;
    private readonly stoppedPageSize: number;

    constructor(
        private readonly telegramBotService: TelegramBotService,
        private readonly getGridsWithPnlUseCase: GetGridsWithPnlUseCase,
        configService: ConfigService<Config, true>,
    ) {
        const pagination = configService.get('telegram', { infer: true }).pagination;
        this.activePageSize = pagination.activePageSize;
        this.stoppedPageSize = pagination.stoppedPageSize;
    }

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
        const currentPage = 1;
        const view = await this.buildActiveView(currentPage);
        await ctx.reply(view.text, {
            parse_mode: TelegramParseMode.HTML,
            ...toInlineKeyboard(view.keyboard),
        });
    }

    private async editActiveList(ctx: BotContext, page: number): Promise<void> {
        await ctx.answerCbQuery();
        const view = await this.buildActiveView(page);
        await ctx.editMessageText(view.text, {
            parse_mode: TelegramParseMode.HTML,
            ...toInlineKeyboard(view.keyboard),
        });
    }

    private async sendStoppedList(ctx: BotContext): Promise<void> {
        const currentPage = 1;
        const view = await this.buildStoppedView(currentPage);
        await ctx.reply(view.text, {
            parse_mode: TelegramParseMode.HTML,
            ...toInlineKeyboard(view.keyboard),
        });
    }

    private async editStoppedList(ctx: BotContext, page: number): Promise<void> {
        await ctx.answerCbQuery();
        const view = await this.buildStoppedView(page);
        await ctx.editMessageText(view.text, {
            parse_mode: TelegramParseMode.HTML,
            ...toInlineKeyboard(view.keyboard),
        });
    }

    private async buildActiveView(page: number) {
        const { items, totalCount, currentPage } = await this.getGridsWithPnlUseCase.execute(
            GridFilter.Running,
            page,
            this.activePageSize,
        );
        const { totalPages, startIndex } = this.resolvePagination(
            totalCount,
            currentPage,
            this.activePageSize,
        );
        const header = ActiveGridsHeaderMessage.create(totalCount, currentPage, totalPages).text;
        const text = GridListMessage.create(header, items, startIndex).text;
        const keyboard = GridsListKeyboard.create(
            items,
            startIndex,
            GridsAction.activePage,
            currentPage,
            totalPages,
        );
        return { text, keyboard };
    }

    private async buildStoppedView(page: number) {
        const { items, totalCount, currentPage } = await this.getGridsWithPnlUseCase.execute(
            GridFilter.Stopped,
            page,
            this.stoppedPageSize,
        );
        const { totalPages, startIndex } = this.resolvePagination(
            totalCount,
            currentPage,
            this.stoppedPageSize,
        );
        const header = StoppedGridsHeaderMessage.create(currentPage, totalPages, totalCount).text;
        const text = GridListMessage.create(header, items, startIndex).text;
        const keyboard = GridsListKeyboard.create(
            items,
            startIndex,
            GridsAction.stoppedPage,
            currentPage,
            totalPages,
        );
        return { text, keyboard };
    }

    private resolvePagination(
        totalCount: number,
        currentPage: number,
        pageSize: number,
    ): { totalPages: number; startIndex: number } {
        const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
        const startIndex = (currentPage - 1) * pageSize;
        return { totalPages, startIndex };
    }
}
