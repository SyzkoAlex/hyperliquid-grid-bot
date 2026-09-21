import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GridOrdersTabHandler } from './grid-orders-tab.handler';
import { TelegramBotService } from '../../telegram-bot.service';
import { BotContext } from '../../types/bot-context';
import { GetGridWithPnlUseCase } from '@components/telegram/core/application/use-cases/get-grid-with-pnl/get-grid-with-pnl.use-case';
import { GridAction } from '@components/telegram/core/domain/models/grid-action';
import { TelegramParseMode } from '@components/telegram/core/domain/models/telegram-parse-mode';
import { GridViewTexts } from '@components/telegram/core/domain/models/messages/grid-view/grid-view.texts';
import { GridSnapshotDto } from '@components/grids/api/dto/grid-snapshot.dto';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { GridStatus } from '@domain/models/grid/grid-status';

const GRID_ID = '550e8400-e29b-41d4-a716-446655440000';
const USER_ID = 'user-1';

function makeGrid(): GridDto {
    return {
        id: GRID_ID,
        userId: 'user-1',
        symbol: 'BTC',
        status: GridStatus.Running,
        lowerPrice: 90000,
        upperPrice: 100000,
        orderCount: 10,
        investmentUSDC: 500,
        investmentBase: 0,
        trailingEnabled: false,
        trailingTriggerPercent: 0,
        trailingStepPercent: 0,
        trailingPartialClosePercent: 0,
        stopLossEnabled: false,
    };
}

function makeSnapshot(): GridSnapshotDto {
    return {
        grid: makeGrid(),
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

function createMockContext(
    match?: string[],
    user: { id: string } | undefined = { id: USER_ID },
): BotContext {
    return {
        match,
        user,
        reply: vi.fn(),
        answerCbQuery: vi.fn(),
        editMessageText: vi.fn(),
        deleteMessage: vi.fn(),
    } as unknown as BotContext;
}

describe('GridOrdersTabHandler', () => {
    let handler: GridOrdersTabHandler;
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

        handler = new GridOrdersTabHandler(botService, getGridWithPnlUseCase);
        handler.register();
    });

    describe('register', () => {
        it('should register VIEW_ORDERS_PATTERN', () => {
            expect(botService.onAction).toHaveBeenCalledWith(
                GridAction.VIEW_ORDERS_PATTERN,
                expect.any(Function),
            );
        });
    });

    describe('handle', () => {
        it('should fetch grid and edit message with orders tab', async () => {
            const ctx = createMockContext([`view:grid:${GRID_ID}:p:1:orders`, GRID_ID, '1']);

            await actionCallbacks.get(GridAction.VIEW_ORDERS_PATTERN)!(ctx);

            expect(ctx.answerCbQuery).toHaveBeenCalled();
            expect(getGridWithPnlUseCase.execute).toHaveBeenCalledWith(USER_ID, GRID_ID);
            expect(ctx.editMessageText).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ parse_mode: TelegramParseMode.HTML }),
            );
        });

        it('should reply NOT_FOUND without calling the use case when ctx.user is missing', async () => {
            const ctx = {
                ...createMockContext([`view:grid:${GRID_ID}:p:1:orders`, GRID_ID, '1']),
                user: undefined,
            } as BotContext;

            await actionCallbacks.get(GridAction.VIEW_ORDERS_PATTERN)!(ctx);

            expect(getGridWithPnlUseCase.execute).not.toHaveBeenCalled();
            expect(ctx.reply).toHaveBeenCalledWith(GridViewTexts.NOT_FOUND, {
                parse_mode: TelegramParseMode.HTML,
            });
        });
    });
});
