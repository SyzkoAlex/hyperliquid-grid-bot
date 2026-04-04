import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GridProfitTabHandler } from './grid-profit-tab.handler';
import { TelegramBotService } from '../../telegram-bot.service';
import { BotContext } from '../../types/bot-context';
import { GetGridWithPnlUseCase } from '@components/telegram/core/application/use-cases/get-grid-with-pnl/get-grid-with-pnl.use-case';
import { GridAction } from '@components/telegram/core/domain/models/grid-action';
import { GridViewTexts } from '@components/telegram/core/domain/models/messages/grid-view/grid-view.texts';
import { TelegramParseMode } from '@components/telegram/core/domain/models/telegram-parse-mode';
import { GridSnapshot } from '@components/telegram/core/domain/models/grid-snapshot';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { GridMode } from '@domain/models/grid/grid-mode';
import { GridStatus } from '@domain/models/grid/grid-status';

const GRID_ID = '550e8400-e29b-41d4-a716-446655440000';

function makeGrid(status = GridStatus.Running): GridDto {
    return {
        id: GRID_ID,
        symbol: 'BTC',
        mode: GridMode.Neutral,
        status,
        lowerPrice: 90000,
        upperPrice: 100000,
        levels: 10,
        investmentUSDC: 500,
        investmentBase: 0,
        trailingEnabled: false,
        trailingTriggerPercent: 0,
        trailingStepPercent: 0,
        trailingPartialClosePercent: 0,
    };
}

function makeSnapshot(status = GridStatus.Running): GridSnapshot {
    return {
        grid: makeGrid(status),
        pnl: { gridProfit: 10, unrealizedPnl: -2, totalFees: 0 },
        currentPrice: 95000,
        orderStats: {
            activeBuys: 3,
            activeSells: 4,
            avgActiveBuyPrice: 91000,
            avgActiveSellPrice: 96000,
            lowestActiveBuyPrice: 90000,
            highestActiveSellPrice: 100000,
            filledCycles: 2,
        },
        activeOrders: [],
        filledOrders: [],
    };
}

function createMockContext(match?: string[]): BotContext {
    return {
        match,
        reply: vi.fn(),
        answerCbQuery: vi.fn(),
        editMessageText: vi.fn(),
        deleteMessage: vi.fn(),
    } as unknown as BotContext;
}

describe('GridProfitTabHandler', () => {
    let handler: GridProfitTabHandler;
    let botService: TelegramBotService;
    let getGridWithPnlUseCase: GetGridWithPnlUseCase;
    let actionCallbacks: Map<string | RegExp, (ctx: BotContext) => Promise<void>>;

    beforeEach(() => {
        actionCallbacks = new Map();

        botService = {
            onAction: vi.fn((action: string | RegExp, cb: (ctx: BotContext) => Promise<void>) => {
                actionCallbacks.set(action, cb);
            }),
        } as unknown as TelegramBotService;

        getGridWithPnlUseCase = {
            execute: vi.fn().mockResolvedValue(makeSnapshot()),
        } as unknown as GetGridWithPnlUseCase;

        handler = new GridProfitTabHandler(botService, getGridWithPnlUseCase);
        handler.register();
    });

    describe('register', () => {
        it('should register VIEW_PATTERN', () => {
            expect(botService.onAction).toHaveBeenCalledWith(
                GridAction.VIEW_PATTERN,
                expect.any(Function),
            );
        });
    });

    describe('handle', () => {
        it('should fetch grid and edit message with profit tab', async () => {
            const ctx = createMockContext([`view:grid:${GRID_ID}:p:1`, GRID_ID, '1']);

            await actionCallbacks.get(GridAction.VIEW_PATTERN)!(ctx);

            expect(ctx.answerCbQuery).toHaveBeenCalled();
            expect(getGridWithPnlUseCase.execute).toHaveBeenCalledWith(GRID_ID);
            expect(ctx.editMessageText).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ parse_mode: TelegramParseMode.HTML }),
            );
        });

        it('should reply NOT_FOUND when grid does not exist', async () => {
            vi.mocked(getGridWithPnlUseCase.execute).mockResolvedValue(null);
            const ctx = createMockContext([`view:grid:${GRID_ID}:p:1`, GRID_ID, '1']);

            await actionCallbacks.get(GridAction.VIEW_PATTERN)!(ctx);

            expect(ctx.reply).toHaveBeenCalledWith(GridViewTexts.NOT_FOUND, {
                parse_mode: TelegramParseMode.HTML,
            });
            expect(ctx.editMessageText).not.toHaveBeenCalled();
        });

        it('should reply LOAD_ERROR when use case throws', async () => {
            vi.mocked(getGridWithPnlUseCase.execute).mockRejectedValue(new Error('DB error'));
            const ctx = createMockContext([`view:grid:${GRID_ID}:p:1`, GRID_ID, '1']);

            await actionCallbacks.get(GridAction.VIEW_PATTERN)!(ctx);

            expect(ctx.reply).toHaveBeenCalledWith(GridViewTexts.LOAD_ERROR, {
                parse_mode: TelegramParseMode.HTML,
            });
        });

        it('should include Orders and Stop buttons for a running grid', async () => {
            const ctx = createMockContext([`view:grid:${GRID_ID}:p:1`, GRID_ID, '1']);

            await actionCallbacks.get(GridAction.VIEW_PATTERN)!(ctx);

            const [, options] = vi.mocked(ctx.editMessageText).mock.calls[0];
            const json = JSON.stringify(options);
            expect(json).toContain(GridAction.ordersTab(GRID_ID, 1));
            expect(json).toContain(GridAction.stop(GRID_ID));
        });

        it('should omit Orders and Stop buttons for a stopped grid', async () => {
            vi.mocked(getGridWithPnlUseCase.execute).mockResolvedValue(
                makeSnapshot(GridStatus.Stopped),
            );
            const ctx = createMockContext([`view:grid:${GRID_ID}:p:1`, GRID_ID, '1']);

            await actionCallbacks.get(GridAction.VIEW_PATTERN)!(ctx);

            const [, options] = vi.mocked(ctx.editMessageText).mock.calls[0];
            const json = JSON.stringify(options);
            expect(json).not.toContain(GridAction.ordersTab(GRID_ID, 1));
            expect(json).not.toContain(GridAction.stop(GRID_ID));
            expect(json).toContain(GridAction.historyTab(GRID_ID, 1));
        });
    });
});
