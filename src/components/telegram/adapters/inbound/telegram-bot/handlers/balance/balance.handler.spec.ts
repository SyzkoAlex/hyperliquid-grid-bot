import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BalanceHandler } from './balance.handler';
import { TelegramBotService } from '../../telegram-bot.service';
import { BotContext } from '../../types/bot-context';
import { GetUserBalanceUseCase } from '@components/telegram/core/application/use-cases/get-user-balance/get-user-balance.use-case';
import { TelegramCommand } from '@components/telegram/core/domain/models/telegram-command';
import { TelegramAction } from '@components/telegram/core/domain/models/telegram-action';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels';
import { TelegramParseMode } from '@components/telegram/core/domain/models/telegram-parse-mode';
import { UserBalance } from '@components/telegram/core/domain/models/user-balance';

const MOCK_BALANCE: UserBalance = {
    usdc: { available: 1000, inOrders: 200, total: 1200 },
    tokens: [],
    totalValueUsdc: 1200,
};

describe('BalanceHandler', () => {
    let handler: BalanceHandler;
    let botService: TelegramBotService;
    let getBalanceUseCase: GetUserBalanceUseCase;
    let commandCallbacks: Map<string, (ctx: BotContext) => Promise<void>>;
    let actionCallbacks: Map<string, (ctx: BotContext) => Promise<void>>;
    let hearsCallbacks: Map<string, (ctx: BotContext) => Promise<void>>;

    beforeEach(() => {
        commandCallbacks = new Map();
        actionCallbacks = new Map();
        hearsCallbacks = new Map();

        botService = {
            onCommand: vi.fn((cmd: string, cb: (ctx: BotContext) => Promise<void>) => {
                commandCallbacks.set(cmd, cb);
            }),
            onAction: vi.fn((action: string, cb: (ctx: BotContext) => Promise<void>) => {
                actionCallbacks.set(String(action), cb);
            }),
            onHears: vi.fn((text: string, cb: (ctx: BotContext) => Promise<void>) => {
                hearsCallbacks.set(text, cb);
            }),
        } as unknown as TelegramBotService;

        getBalanceUseCase = {
            execute: vi.fn().mockResolvedValue(MOCK_BALANCE),
        } as unknown as GetUserBalanceUseCase;

        handler = new BalanceHandler(botService, getBalanceUseCase);
    });

    describe('register', () => {
        it('should register /balance command, action, and hears', () => {
            handler.register();

            expect(botService.onCommand).toHaveBeenCalledWith(
                TelegramCommand.Balance,
                expect.any(Function),
            );
            expect(botService.onAction).toHaveBeenCalledWith(
                TelegramAction.ShowBalance,
                expect.any(Function),
            );
            expect(botService.onHears).toHaveBeenCalledWith(
                BUTTON_LABELS.BALANCE,
                expect.any(Function),
            );
        });
    });

    describe('handle (command)', () => {
        it('should fetch balance and reply with formatted text', async () => {
            handler.register();
            const ctx = createMockContext();

            await commandCallbacks.get(TelegramCommand.Balance)!(ctx);

            expect(getBalanceUseCase.execute).toHaveBeenCalled();
            expect(ctx.reply).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ parse_mode: TelegramParseMode.HTML }),
            );
        });

        it('should include Refresh button in reply keyboard', async () => {
            handler.register();
            const ctx = createMockContext();

            await commandCallbacks.get(TelegramCommand.Balance)!(ctx);

            const callArgs = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0];
            const options = callArgs[1];
            expect(options.reply_markup).toBeDefined();
        });
    });

    describe('handle (hears)', () => {
        it('should fetch balance and reply on Balance button', async () => {
            handler.register();
            const ctx = createMockContext();

            await hearsCallbacks.get(BUTTON_LABELS.BALANCE)!(ctx);

            expect(getBalanceUseCase.execute).toHaveBeenCalled();
            expect(ctx.reply).toHaveBeenCalled();
        });
    });

    describe('handleAction', () => {
        it('should answer callback, fetch balance, and edit message', async () => {
            handler.register();
            const ctx = createMockContext();

            await actionCallbacks.get(TelegramAction.ShowBalance)!(ctx);

            expect(ctx.answerCbQuery).toHaveBeenCalled();
            expect(getBalanceUseCase.execute).toHaveBeenCalled();
            expect(ctx.editMessageText).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ parse_mode: TelegramParseMode.HTML }),
            );
        });
    });

    function createMockContext(): BotContext {
        return {
            reply: vi.fn(),
            answerCbQuery: vi.fn(),
            editMessageText: vi.fn(),
            user: { accountAddress: '0xtest' },
        } as unknown as BotContext;
    }
});
