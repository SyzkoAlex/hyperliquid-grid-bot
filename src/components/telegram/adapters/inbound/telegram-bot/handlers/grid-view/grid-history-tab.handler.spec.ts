import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GridHistoryTabHandler } from './grid-history-tab.handler';
import { TelegramBotService } from '../../telegram-bot.service';
import { BotContext } from '../../types/bot-context';
import { GetGridWithPnlUseCase } from '@components/telegram/core/application/use-cases/get-grid-with-pnl/get-grid-with-pnl.use-case';
import { GridAction } from '@components/telegram/core/domain/models/grid-action';
import { TelegramParseMode } from '@components/telegram/core/domain/models/telegram-parse-mode';
import { GridSnapshot } from '@components/telegram/core/domain/models/grid-snapshot';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { OrderDto } from '@components/grids/api/dto/order.dto';
import { GridStatus } from '@domain/models/grid/grid-status';
import { OrderSide } from '@domain/models/order/order-side';
import { OrderStatus } from '@domain/models/order/order-status';
import { OrderType } from '@domain/models/order/order-type';

const GRID_ID = '550e8400-e29b-41d4-a716-446655440000';

function makeGrid(): GridDto {
    return {
        id: GRID_ID,
        symbol: 'BTC',
        status: GridStatus.Running,
        lowerPrice: 90000,
        upperPrice: 100000,
        levels: 10,
        investmentUSDC: 500,
        investmentBase: 0,
        trailingEnabled: false,
        trailingTriggerPercent: 0,
        trailingStepPercent: 0,
        trailingPartialClosePercent: 0,
        stopLossEnabled: false,
    };
}

function makeSnapshot(): GridSnapshot {
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

function makeFilledOrder(filledAt: number): OrderDto {
    return {
        id: '660e8400-e29b-41d4-a716-446655440001',
        gridId: GRID_ID,
        symbol: 'BTC',
        side: OrderSide.Sell,
        status: OrderStatus.Filled,
        type: OrderType.Limit,
        levelIndex: 5,
        price: 96000,
        amount: 0.001,
        exchangeOrderId: null,
        createdAt: filledAt,
        filledAt,
    };
}

function createMockContext(match?: string[], user?: { timezone: string }): BotContext {
    return {
        match,
        user,
        reply: vi.fn(),
        answerCbQuery: vi.fn(),
        editMessageText: vi.fn(),
        deleteMessage: vi.fn(),
    } as unknown as BotContext;
}

describe('GridHistoryTabHandler', () => {
    let handler: GridHistoryTabHandler;
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

        handler = new GridHistoryTabHandler(botService, getGridWithPnlUseCase);
        handler.register();
    });

    describe('register', () => {
        it('should register VIEW_HISTORY_PATTERN', () => {
            expect(botService.onAction).toHaveBeenCalledWith(
                GridAction.VIEW_HISTORY_PATTERN,
                expect.any(Function),
            );
        });
    });

    describe('handle', () => {
        it('should fetch grid and edit message with history tab', async () => {
            const ctx = createMockContext([`view:grid:${GRID_ID}:p:1:history`, GRID_ID, '1']);

            await actionCallbacks.get(GridAction.VIEW_HISTORY_PATTERN)!(ctx);

            expect(ctx.answerCbQuery).toHaveBeenCalled();
            expect(getGridWithPnlUseCase.execute).toHaveBeenCalledWith(GRID_ID);
            expect(ctx.editMessageText).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ parse_mode: TelegramParseMode.HTML }),
            );
        });

        it('should format filled order dates in the user timezone', async () => {
            // May 9 2025 14:32 UTC = May 9 2025 23:32 Asia/Tokyo (UTC+9)
            const TIMESTAMP = Date.UTC(2025, 4, 9, 14, 32);
            const snapshotWithOrder: GridSnapshot = {
                ...makeSnapshot(),
                filledOrders: [makeFilledOrder(TIMESTAMP)],
            };
            vi.mocked(getGridWithPnlUseCase.execute).mockResolvedValueOnce(snapshotWithOrder);
            const ctx = createMockContext([`view:grid:${GRID_ID}:p:1:history`, GRID_ID, '1'], {
                timezone: 'Asia/Tokyo',
            });

            await actionCallbacks.get(GridAction.VIEW_HISTORY_PATTERN)!(ctx);

            const [text] = vi.mocked(ctx.editMessageText).mock.calls[0];
            expect(text).toContain('09 May 23:32');
        });
    });
});
