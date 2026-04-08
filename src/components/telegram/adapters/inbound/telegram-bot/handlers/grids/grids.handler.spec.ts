import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { GridsHandler } from './grids.handler';
import { TelegramBotService } from '../../telegram-bot.service';
import { BotContext } from '../../types/bot-context';
import { GetGridsWithPnlUseCase } from '@components/telegram/core/application/use-cases/get-grids-with-pnl/get-grids-with-pnl.use-case';
import { TelegramCommand } from '@components/telegram/core/domain/models/telegram-command';
import { TelegramAction } from '@components/telegram/core/domain/models/telegram-action';
import { GridsAction } from '@components/telegram/core/domain/models/grids-action';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels';
import { GridFilter } from '@components/telegram/core/application/use-cases/get-grids-with-pnl/grid-filter';
import { TelegramParseMode } from '@components/telegram/core/domain/models/telegram-parse-mode';
import { GridSnapshot } from '@components/telegram/core/domain/models/grid-snapshot';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { GridStatus } from '@domain/models/grid/grid-status';

function makeGrid(id: string, status = GridStatus.Running): GridDto {
    return {
        id,
        symbol: 'BTC',
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

function makeSnapshot(id: string, status = GridStatus.Running): GridSnapshot {
    return {
        grid: makeGrid(id, status),
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

describe('GridsHandler', () => {
    let handler: GridsHandler;
    let botService: TelegramBotService;
    let getGridsWithPnlUseCase: GetGridsWithPnlUseCase;
    let commandCallbacks: Map<string, (ctx: BotContext) => Promise<void>>;
    let actionCallbacks: Map<string | RegExp, (ctx: BotContext) => Promise<void>>;
    let hearsCallbacks: Map<string, (ctx: BotContext) => Promise<void>>;

    beforeEach(() => {
        commandCallbacks = new Map();
        actionCallbacks = new Map();
        hearsCallbacks = new Map();

        botService = {
            onCommand: vi.fn((cmd: string, cb: (ctx: BotContext) => Promise<void>) => {
                commandCallbacks.set(cmd, cb);
            }),
            onAction: vi.fn((action: string | RegExp, cb: (ctx: BotContext) => Promise<void>) => {
                actionCallbacks.set(action, cb);
            }),
            onHears: vi.fn((text: string, cb: (ctx: BotContext) => Promise<void>) => {
                hearsCallbacks.set(text, cb);
            }),
        } as unknown as TelegramBotService;

        getGridsWithPnlUseCase = {
            execute: vi.fn().mockResolvedValue({ items: [], totalCount: 0 }),
        } as unknown as GetGridsWithPnlUseCase;

        const configService = {
            get: vi.fn().mockReturnValue({ pagination: { activePageSize: 5, stoppedPageSize: 5 } }),
        } as unknown as ConfigService<any, true>;

        handler = new GridsHandler(botService, getGridsWithPnlUseCase, configService);
    });

    describe('register', () => {
        it('should register all commands, actions, and hears', () => {
            handler.register();

            expect(botService.onCommand).toHaveBeenCalledWith(
                TelegramCommand.Grids,
                expect.any(Function),
            );
            expect(botService.onHears).toHaveBeenCalledWith(
                BUTTON_LABELS.GRIDS,
                expect.any(Function),
            );
            expect(botService.onHears).toHaveBeenCalledWith(
                BUTTON_LABELS.STOPPED_GRIDS,
                expect.any(Function),
            );
            expect(botService.onAction).toHaveBeenCalledWith(
                TelegramAction.ListGrids,
                expect.any(Function),
            );
            expect(botService.onAction).toHaveBeenCalledWith(
                GridsAction.ACTIVE_PAGE_PATTERN,
                expect.any(Function),
            );
            expect(botService.onAction).toHaveBeenCalledWith(
                GridsAction.STOPPED_PAGE_PATTERN,
                expect.any(Function),
            );
        });
    });

    describe('sendActiveList', () => {
        it('should fetch running grids and reply', async () => {
            handler.register();
            const ctx = createMockContext();

            await commandCallbacks.get(TelegramCommand.Grids)!(ctx);

            expect(getGridsWithPnlUseCase.execute).toHaveBeenCalledWith(GridFilter.Running, 1, 5);
            expect(ctx.reply).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ parse_mode: TelegramParseMode.HTML }),
            );
        });

        it('should display grid items when grids exist', async () => {
            const items = [makeSnapshot('grid-1'), makeSnapshot('grid-2')];
            vi.mocked(getGridsWithPnlUseCase.execute).mockResolvedValue({
                items,
                totalCount: 2,
                currentPage: 1,
            });
            handler.register();
            const ctx = createMockContext();

            await commandCallbacks.get(TelegramCommand.Grids)!(ctx);

            const text = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
            expect(text).toContain('BTC/USDC');
        });
    });

    describe('editActiveList', () => {
        it('should answer callback and edit message', async () => {
            handler.register();
            const ctx = createMockContext();

            await actionCallbacks.get(TelegramAction.ListGrids)!(ctx);

            expect(ctx.answerCbQuery).toHaveBeenCalled();
            expect(getGridsWithPnlUseCase.execute).toHaveBeenCalledWith(GridFilter.Running, 1, 5);
            expect(ctx.editMessageText).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ parse_mode: TelegramParseMode.HTML }),
            );
        });
    });

    describe('sendStoppedList', () => {
        it('should fetch stopped grids and reply', async () => {
            handler.register();
            const ctx = createMockContext();

            await hearsCallbacks.get(BUTTON_LABELS.STOPPED_GRIDS)!(ctx);

            expect(getGridsWithPnlUseCase.execute).toHaveBeenCalledWith(GridFilter.Stopped, 1, 5);
            expect(ctx.reply).toHaveBeenCalled();
        });
    });

    describe('pagination', () => {
        it('should parse page from active page action', async () => {
            vi.mocked(getGridsWithPnlUseCase.execute).mockResolvedValue({
                items: Array.from({ length: 10 }, (_, i) => makeSnapshot(`grid-${i}`)),
                totalCount: 10,
                currentPage: 2,
            });
            handler.register();
            const ctx = createMockContext({
                match: ['grids:active:2', '2'] as unknown as RegExpExecArray,
            });

            await actionCallbacks.get(GridsAction.ACTIVE_PAGE_PATTERN)!(ctx);

            expect(getGridsWithPnlUseCase.execute).toHaveBeenCalledWith(GridFilter.Running, 2, 5);
        });

        it('should parse page from stopped page action', async () => {
            handler.register();
            const ctx = createMockContext({
                match: ['grids:stopped:3', '3'] as unknown as RegExpExecArray,
            });

            await actionCallbacks.get(GridsAction.STOPPED_PAGE_PATTERN)!(ctx);

            expect(getGridsWithPnlUseCase.execute).toHaveBeenCalledWith(GridFilter.Stopped, 3, 5);
        });
    });

    function createMockContext(overrides: Partial<BotContext> = {}): BotContext {
        return {
            reply: vi.fn(),
            answerCbQuery: vi.fn(),
            editMessageText: vi.fn(),
            ...overrides,
        } as unknown as BotContext;
    }
});
