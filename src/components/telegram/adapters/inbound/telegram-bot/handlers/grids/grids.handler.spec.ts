import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { GridsHandler } from './grids.handler';
import { TelegramBotService } from '../../telegram-bot.service';
import { BotContext } from '../../types/bot-context';
import { GetGridsWithPnlUseCase } from '@components/telegram/core/application/use-cases/get-grids-with-pnl/get-grids-with-pnl.use-case';
import { ActiveGridsViewBuilder } from '@components/telegram/core/application/services/active-grids-view-builder/active-grids-view-builder.service';
import { TelegramCommand } from '@components/telegram/core/domain/models/telegram-command';
import { TelegramAction } from '@components/telegram/core/domain/models/telegram-action';
import { GridsAction } from '@components/telegram/core/domain/models/grids-action';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels';
import { GridFilter } from '@components/telegram/core/application/use-cases/get-grids-with-pnl/grid-filter';
import { TelegramParseMode } from '@components/telegram/core/domain/models/telegram-parse-mode';
import { UserStatus } from '@domain/models/user/user-status';

describe('GridsHandler', () => {
    let handler: GridsHandler;
    let botService: TelegramBotService;
    let getGridsWithPnlUseCase: GetGridsWithPnlUseCase;
    let viewBuilder: ActiveGridsViewBuilder;
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
            execute: vi.fn().mockResolvedValue({ items: [], totalCount: 0, currentPage: 1 }),
        } as unknown as GetGridsWithPnlUseCase;

        viewBuilder = {
            build: vi
                .fn()
                .mockResolvedValue({ text: '<b>Active Grids</b>', keyboard: [], totalCount: 0 }),
        } as unknown as ActiveGridsViewBuilder;

        const configService = {
            get: vi.fn().mockReturnValue({ pagination: { activePageSize: 5, stoppedPageSize: 5 } }),
        } as unknown as ConfigService<any, true>;

        handler = new GridsHandler(botService, getGridsWithPnlUseCase, configService, viewBuilder);
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
        it('should delegate to viewBuilder and reply for active user', async () => {
            handler.register();
            const ctx = createActiveContext();

            await commandCallbacks.get(TelegramCommand.Grids)!(ctx);

            expect(viewBuilder.build).toHaveBeenCalledWith(1);
            expect(ctx.reply).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ parse_mode: TelegramParseMode.HTML }),
            );
        });

        it('should display grid items from viewBuilder when grids exist', async () => {
            vi.mocked(viewBuilder.build).mockResolvedValue({
                text: '<b>Active Grids</b>\n\nBTC/USDC grid',
                keyboard: [],
                totalCount: 2,
            });
            handler.register();
            const ctx = createActiveContext();

            await commandCallbacks.get(TelegramCommand.Grids)!(ctx);

            const text = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
            expect(text).toContain('BTC/USDC');
        });

        it('should reply with no-grids placeholder for non-active user', async () => {
            handler.register();
            const ctx = createMockContext();

            await commandCallbacks.get(TelegramCommand.Grids)!(ctx);

            expect(viewBuilder.build).not.toHaveBeenCalled();
            expect(ctx.reply).toHaveBeenCalledWith(
                expect.stringContaining('No active grids'),
                expect.objectContaining({ parse_mode: TelegramParseMode.HTML }),
            );
        });
    });

    describe('editActiveList', () => {
        it('should answer callback and edit message via viewBuilder for active user', async () => {
            handler.register();
            const ctx = createActiveContext();

            await actionCallbacks.get(TelegramAction.ListGrids)!(ctx);

            expect(ctx.answerCbQuery).toHaveBeenCalled();
            expect(viewBuilder.build).toHaveBeenCalledWith(1);
            expect(ctx.editMessageText).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ parse_mode: TelegramParseMode.HTML }),
            );
        });

        it('should edit message with no-grids placeholder for non-active user', async () => {
            handler.register();
            const ctx = createMockContext();

            await actionCallbacks.get(TelegramAction.ListGrids)!(ctx);

            expect(ctx.answerCbQuery).toHaveBeenCalled();
            expect(viewBuilder.build).not.toHaveBeenCalled();
            expect(ctx.editMessageText).toHaveBeenCalledWith(
                expect.stringContaining('No active grids'),
                expect.objectContaining({ parse_mode: TelegramParseMode.HTML }),
            );
        });
    });

    describe('sendStoppedList', () => {
        it('should fetch stopped grids and reply for active user', async () => {
            handler.register();
            const ctx = createActiveContext();

            await hearsCallbacks.get(BUTTON_LABELS.STOPPED_GRIDS)!(ctx);

            expect(getGridsWithPnlUseCase.execute).toHaveBeenCalledWith(GridFilter.Stopped, 1, 5);
            expect(ctx.reply).toHaveBeenCalled();
        });

        it('should reply with no-history placeholder for non-active user', async () => {
            handler.register();
            const ctx = createMockContext();

            await hearsCallbacks.get(BUTTON_LABELS.STOPPED_GRIDS)!(ctx);

            expect(getGridsWithPnlUseCase.execute).not.toHaveBeenCalled();
            expect(ctx.reply).toHaveBeenCalledWith(
                expect.stringContaining('No stopped grids'),
                expect.objectContaining({ parse_mode: TelegramParseMode.HTML }),
            );
        });
    });

    describe('pagination', () => {
        it('should parse page from active page action and delegate to viewBuilder', async () => {
            handler.register();
            const ctx = createActiveContext({
                match: ['grids:active:2', '2'] as unknown as RegExpExecArray,
            });

            await actionCallbacks.get(GridsAction.ACTIVE_PAGE_PATTERN)!(ctx);

            expect(viewBuilder.build).toHaveBeenCalledWith(2);
        });

        it('should parse page from stopped page action', async () => {
            handler.register();
            const ctx = createActiveContext({
                match: ['grids:stopped:3', '3'] as unknown as RegExpExecArray,
            });

            await actionCallbacks.get(GridsAction.STOPPED_PAGE_PATTERN)!(ctx);

            expect(getGridsWithPnlUseCase.execute).toHaveBeenCalledWith(GridFilter.Stopped, 3, 5);
        });
    });

    function createActiveContext(overrides: Partial<BotContext> = {}): BotContext {
        return {
            reply: vi.fn(),
            answerCbQuery: vi.fn(),
            editMessageText: vi.fn(),
            user: { status: UserStatus.Active, accountAddress: '0xtest' },
            ...overrides,
        } as unknown as BotContext;
    }

    function createMockContext(overrides: Partial<BotContext> = {}): BotContext {
        return {
            reply: vi.fn(),
            answerCbQuery: vi.fn(),
            editMessageText: vi.fn(),
            user: undefined,
            ...overrides,
        } as unknown as BotContext;
    }
});
