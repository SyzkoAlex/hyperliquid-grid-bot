import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StopGridHandler } from './stop-grid.handler';
import { TelegramBotService } from '../../telegram-bot.service';
import { BotContext } from '../../types/bot-context';
import { GetGridWithPnlUseCase } from '@components/telegram/core/application/use-cases/get-grid-with-pnl/get-grid-with-pnl.use-case';
import { StopGridUseCase } from '@components/telegram/core/application/use-cases/stop-grid/stop-grid.use-case';
import { GridAction } from '@components/telegram/core/domain/models/grid-action';
import { GridViewTexts } from '@components/telegram/core/domain/models/messages/grid-view/grid-view.texts';
import { TelegramParseMode } from '@components/telegram/core/domain/models/telegram-parse-mode';
import { GridSnapshot } from '@components/telegram/core/domain/models/grid-snapshot';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { GridStatus } from '@domain/models/grid/grid-status';

const GRID_ID = '550e8400-e29b-41d4-a716-446655440000';

function makeGrid(): GridDto {
    return {
        id: GRID_ID,
        userId: 'user-1',
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

function createMockContext(match?: string[]): BotContext {
    return {
        match,
        reply: vi.fn(),
        answerCbQuery: vi.fn(),
        editMessageText: vi.fn(),
        deleteMessage: vi.fn(),
        user: { accountAddress: '0xtest' },
    } as unknown as BotContext;
}

describe('StopGridHandler', () => {
    let handler: StopGridHandler;
    let botService: TelegramBotService;
    let getGridWithPnlUseCase: GetGridWithPnlUseCase;
    let stopGridUseCase: StopGridUseCase;
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

        stopGridUseCase = {
            execute: vi.fn().mockResolvedValue(undefined),
        } as unknown as StopGridUseCase;

        handler = new StopGridHandler(botService, getGridWithPnlUseCase, stopGridUseCase);
        handler.register();
    });

    describe('register', () => {
        it('should register all three stop patterns', () => {
            expect(botService.onAction).toHaveBeenCalledWith(
                GridAction.STOP_PATTERN,
                expect.any(Function),
            );
            expect(botService.onAction).toHaveBeenCalledWith(
                GridAction.CONFIRM_STOP_PATTERN,
                expect.any(Function),
            );
            expect(botService.onAction).toHaveBeenCalledWith(
                GridAction.CANCEL_STOP_PATTERN,
                expect.any(Function),
            );
        });
    });

    describe('handleStopRequest', () => {
        it('should show stop confirmation with Yes/Cancel buttons', async () => {
            const ctx = createMockContext([`stop:grid:${GRID_ID}`, GRID_ID]);

            await actionCallbacks.get(GridAction.STOP_PATTERN)!(ctx);

            expect(ctx.answerCbQuery).toHaveBeenCalled();
            expect(ctx.reply).toHaveBeenCalledWith(
                expect.stringContaining('Stop grid?'),
                expect.objectContaining({ parse_mode: TelegramParseMode.HTML }),
            );
        });

        it('should not show confirmation if grid not found', async () => {
            vi.mocked(getGridWithPnlUseCase.execute).mockResolvedValue(null);
            const ctx = createMockContext([`stop:grid:${GRID_ID}`, GRID_ID]);

            await actionCallbacks.get(GridAction.STOP_PATTERN)!(ctx);

            expect(ctx.reply).toHaveBeenCalledWith(GridViewTexts.NOT_FOUND, {
                parse_mode: TelegramParseMode.HTML,
            });
        });
    });

    describe('handleConfirmStop', () => {
        it('should stop grid and show success message', async () => {
            const ctx = createMockContext([`confirm:stop:${GRID_ID}`, GRID_ID]);

            await actionCallbacks.get(GridAction.CONFIRM_STOP_PATTERN)!(ctx);

            expect(ctx.answerCbQuery).toHaveBeenCalled();
            expect(stopGridUseCase.execute).toHaveBeenCalledWith(GRID_ID, '0xtest');
            expect(ctx.editMessageText).toHaveBeenCalledWith(
                GridViewTexts.STOPPED_SUCCESS,
                expect.objectContaining({ parse_mode: TelegramParseMode.HTML }),
            );
        });

        it('should show error message when stop fails', async () => {
            vi.mocked(stopGridUseCase.execute).mockRejectedValue(new Error('Exchange error'));
            const ctx = createMockContext([`confirm:stop:${GRID_ID}`, GRID_ID]);

            await actionCallbacks.get(GridAction.CONFIRM_STOP_PATTERN)!(ctx);

            expect(ctx.editMessageText).toHaveBeenCalledWith(
                GridViewTexts.STOPPED_ERROR,
                expect.objectContaining({ parse_mode: TelegramParseMode.HTML }),
            );
        });

        it('should prevent double-stop with stoppingGrids guard', async () => {
            let resolveStop: () => void;
            vi.mocked(stopGridUseCase.execute).mockImplementation(
                () => new Promise<void>((resolve) => (resolveStop = resolve)),
            );

            const ctx1 = createMockContext([`confirm:stop:${GRID_ID}`, GRID_ID]);
            const stopPromise = actionCallbacks.get(GridAction.CONFIRM_STOP_PATTERN)!(ctx1);

            const ctx2 = createMockContext([`confirm:stop:${GRID_ID}`, GRID_ID]);
            await actionCallbacks.get(GridAction.CONFIRM_STOP_PATTERN)!(ctx2);

            expect(ctx2.answerCbQuery).toHaveBeenCalledWith('Grid is already being stopped...');
            expect(stopGridUseCase.execute).toHaveBeenCalledTimes(1);

            resolveStop!();
            await stopPromise;
        });

        it('should clear stoppingGrids guard after completion', async () => {
            const ctx1 = createMockContext([`confirm:stop:${GRID_ID}`, GRID_ID]);
            await actionCallbacks.get(GridAction.CONFIRM_STOP_PATTERN)!(ctx1);

            const ctx2 = createMockContext([`confirm:stop:${GRID_ID}`, GRID_ID]);
            await actionCallbacks.get(GridAction.CONFIRM_STOP_PATTERN)!(ctx2);

            expect(stopGridUseCase.execute).toHaveBeenCalledTimes(2);
        });

        it('should clear stoppingGrids guard even on error', async () => {
            vi.mocked(stopGridUseCase.execute).mockRejectedValueOnce(new Error('fail'));
            const ctx1 = createMockContext([`confirm:stop:${GRID_ID}`, GRID_ID]);
            await actionCallbacks.get(GridAction.CONFIRM_STOP_PATTERN)!(ctx1);

            vi.mocked(stopGridUseCase.execute).mockResolvedValue(undefined);
            const ctx2 = createMockContext([`confirm:stop:${GRID_ID}`, GRID_ID]);
            await actionCallbacks.get(GridAction.CONFIRM_STOP_PATTERN)!(ctx2);

            expect(stopGridUseCase.execute).toHaveBeenCalledTimes(2);
        });
    });

    describe('handleCancelStop', () => {
        it('should answer callback and delete message', async () => {
            const ctx = createMockContext([`cancel:stop:${GRID_ID}`, GRID_ID]);

            await actionCallbacks.get(GridAction.CANCEL_STOP_PATTERN)!(ctx);

            expect(ctx.answerCbQuery).toHaveBeenCalled();
            expect(ctx.deleteMessage).toHaveBeenCalled();
        });
    });
});
