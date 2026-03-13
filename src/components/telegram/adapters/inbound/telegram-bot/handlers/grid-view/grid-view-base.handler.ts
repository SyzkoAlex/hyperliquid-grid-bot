import { GetGridWithPnlUseCase } from '@components/telegram/core/application/use-cases/get-grid-with-pnl/get-grid-with-pnl.use-case';
import { BotContext } from '../../types/bot-context';
import { GridSnapshot } from '@components/telegram/core/domain/models/grid-snapshot';
import { GridViewTexts } from '@components/telegram/core/domain/models/messages/grid-view/grid-view.texts';
import { TelegramParseMode } from '@components/telegram/core/domain/models/telegram-parse-mode';
import { GridStatus } from '@domain/models/grid/grid-status';
import { toInlineKeyboard } from '../inline-keyboard';
import { Markup } from 'telegraf';
import { logger } from '@/infra/logger/logger';
import { Handler } from '../handler';
import {
    BackToGridDetailButton,
    BackToGridsButton,
    HistoryTabButton,
    OrdersTabButton,
    StopGridButton,
} from './grid-view.buttons';

export abstract class GridViewBaseHandler implements Handler {
    protected readonly logger = logger.child({ context: this.constructor.name });

    protected constructor(protected readonly getGridWithPnlUseCase: GetGridWithPnlUseCase) {}

    abstract register(): void;

    protected async fetchGridSnapshot(
        ctx: BotContext,
        gridId: string,
    ): Promise<GridSnapshot | null> {
        try {
            const snapshot = await this.getGridWithPnlUseCase.execute(gridId);
            if (!snapshot) {
                await ctx.reply(GridViewTexts.NOT_FOUND, { parse_mode: TelegramParseMode.HTML });
                return null;
            }
            return snapshot;
        } catch (error) {
            this.logger.error({ error, gridId }, 'Failed to fetch grid');
            await ctx.reply(GridViewTexts.LOAD_ERROR, { parse_mode: TelegramParseMode.HTML });
            return null;
        }
    }

    protected buildDetailKeyboard(
        gridId: string,
        status: GridStatus,
        page: number,
    ): ReturnType<typeof Markup.inlineKeyboard> {
        const running = status === GridStatus.Running;

        const topRow = running
            ? [OrdersTabButton.create(gridId, page), HistoryTabButton.create(gridId, page)]
            : [HistoryTabButton.create(gridId, page)];

        const bottomRow = running
            ? [StopGridButton.create(gridId), BackToGridsButton.create(status, page)]
            : [BackToGridsButton.create(status, page)];

        return toInlineKeyboard([topRow, bottomRow]);
    }

    protected buildSubTabKeyboard(
        gridId: string,
        page: number,
    ): ReturnType<typeof Markup.inlineKeyboard> {
        return toInlineKeyboard([[BackToGridDetailButton.create(gridId, page)]]);
    }
}
