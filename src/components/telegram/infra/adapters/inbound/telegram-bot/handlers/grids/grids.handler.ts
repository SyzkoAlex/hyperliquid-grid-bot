import { Injectable } from '@nestjs/common';
import { Markup } from 'telegraf';
import { TelegramBotService } from '../../telegram-bot.service';
import { BotContext } from '../../types/bot-context';
import {
    TelegramAction,
    TelegramCommand,
} from '@components/telegram/domain/models/telegram-command.enum';
import { Handler } from '../handler';
import { GetGridsWithPnlUseCase } from '@components/telegram/application/use-cases/get-grids-with-pnl/get-grids-with-pnl.use-case';
import { GridFilter } from '@components/telegram/application/use-cases/get-grids-with-pnl/grid-filter';
import { GridWithPnl } from '@components/telegram/application/use-cases/get-grids-with-pnl/grid-with-pnl';
import { GridListItemMessage } from '@components/telegram/domain/models/messages/grid-list-item.message';
import { InlineButton } from '@components/telegram/domain/models/inline-button';
import { PriceFormatter } from '@components/telegram/domain/models/formatters/price.formatter';
import { EMOJI } from '@components/telegram/domain/models/constants/emoji.constants';

@Injectable()
export class GridsHandler implements Handler {
    constructor(
        private readonly telegramBotService: TelegramBotService,
        private readonly getGridsWithPnlUseCase: GetGridsWithPnlUseCase,
    ) {}

    register(): void {
        this.telegramBotService.onCommand(TelegramCommand.Grids, (ctx) => this.handle(ctx));
        this.telegramBotService.onAction(TelegramAction.ListGrids, (ctx) => this.handleAction(ctx));
    }

    private async handle(ctx: BotContext): Promise<void> {
        const items = await this.getGridsWithPnlUseCase.execute(GridFilter.All);
        const text = this.buildText(items);
        const markup = this.buildKeyboard(items);
        await ctx.reply(text, { parse_mode: this.telegramBotService.getParseMode(), ...markup });
    }

    private async handleAction(ctx: BotContext): Promise<void> {
        await ctx.answerCbQuery();
        const items = await this.getGridsWithPnlUseCase.execute(GridFilter.All);
        const text = this.buildText(items);
        const markup = this.buildKeyboard(items);
        await ctx.editMessageText(text, {
            parse_mode: this.telegramBotService.getParseMode(),
            ...markup,
        });
    }

    private buildText(items: GridWithPnl[]): string {
        if (items.length === 0) {
            return `<b>${EMOJI.CLIPBOARD} My Grids</b>\n\nNo grids found. Create your first grid!`;
        }
        const header = `<b>${EMOJI.CLIPBOARD} My Grids</b> (${items.length})`;
        const cards = items.map((item) => GridListItemMessage.fromCardData(item)).join('\n\n');
        return `${header}\n\n${cards}`;
    }

    private buildKeyboard(items: GridWithPnl[]): ReturnType<typeof Markup.inlineKeyboard> {
        const rows: InlineButton[][] = items.map(({ grid }) => {
            const lower = PriceFormatter.format(grid.lowerPrice.toNumber());
            const upper = PriceFormatter.format(grid.upperPrice.toNumber());
            return [
                {
                    text: `${grid.symbol.toString()} ($${lower} – $${upper})`,
                    action: `view:grid:${grid.id.toString()}`,
                },
            ];
        });

        rows.push([{ text: '« Back to Menu', action: TelegramAction.MainMenu }]);

        return Markup.inlineKeyboard(
            rows.map((row) => row.map((btn) => Markup.button.callback(btn.text, btn.action))),
        );
    }
}
