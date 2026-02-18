import { Injectable } from '@nestjs/common';
import { Markup } from 'telegraf';
import { TelegramBotService } from '../../telegram-bot.service';
import { BotContext } from '../../types/bot-context';
import {
    TelegramCommand,
    TelegramAction,
} from '@components/telegram/domain/models/telegram-command.enum';
import { Handler } from '../handler';
import { GetGridsUseCase } from '@components/telegram/application/use-cases/get-grids/get-grids.use-case';
import { GridMessageBuilderService } from '@components/telegram/domain/services/grid-message-builder/grid-message-builder.service';
import { Grid } from '@domain/models/grid/grid';
import { InlineButton } from '@components/telegram/domain/models/inline-button';

@Injectable()
export class GridsHandler implements Handler {
    constructor(
        private readonly telegramBotService: TelegramBotService,
        private readonly getGridsUseCase: GetGridsUseCase,
        private readonly gridMessageBuilder: GridMessageBuilderService,
    ) {}

    register(): void {
        this.telegramBotService.onCommand(TelegramCommand.Grids, (ctx) => this.handle(ctx));
        this.telegramBotService.onAction(TelegramAction.ListGrids, (ctx) => this.handleAction(ctx));
    }

    private async handle(ctx: BotContext): Promise<void> {
        const grids = await this.getGridsUseCase.execute('all');
        const text = this.gridMessageBuilder.buildGridList(grids);
        const markup = this.buildKeyboard(grids);
        await ctx.reply(text, { parse_mode: this.telegramBotService.getParseMode(), ...markup });
    }

    private async handleAction(ctx: BotContext): Promise<void> {
        await ctx.answerCbQuery();
        const grids = await this.getGridsUseCase.execute('all');
        const text = this.gridMessageBuilder.buildGridList(grids);
        const markup = this.buildKeyboard(grids);
        await ctx.editMessageText(text, {
            parse_mode: this.telegramBotService.getParseMode(),
            ...markup,
        });
    }

    private buildKeyboard(grids: Grid[]): ReturnType<typeof Markup.inlineKeyboard> {
        const rows: InlineButton[][] = grids.map((grid) => [
            {
                text: `📊 ${grid.symbol.toString()} Details`,
                action: `view:grid:${grid.id.toString()}`,
            },
        ]);

        rows.push([{ text: '➕ Create Grid', action: TelegramAction.CreateGrid }]);
        rows.push([{ text: '« Back to Menu', action: TelegramAction.MainMenu }]);

        return Markup.inlineKeyboard(
            rows.map((row) => row.map((btn) => Markup.button.callback(btn.text, btn.action))),
        );
    }
}
