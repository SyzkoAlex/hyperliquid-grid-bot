import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StartHandler } from './start.handler';
import { TelegramBotService } from '../../telegram-bot.service';
import { BotContext } from '../../types/bot-context';
import { TelegramCommand } from '@components/telegram/core/domain/models/telegram-command';
import { UserStatus } from '@domain/models/user/user-status';

describe('StartHandler', () => {
    let handler: StartHandler;
    let botService: TelegramBotService;
    let mockUsersApi: { findUserByChatId: ReturnType<typeof vi.fn> };
    let registeredCallbacks: Map<string, (ctx: BotContext) => Promise<void>>;

    beforeEach(() => {
        registeredCallbacks = new Map();

        botService = {
            onCommand: vi.fn((cmd: string, cb: (ctx: BotContext) => Promise<void>) => {
                registeredCallbacks.set(`cmd:${cmd}`, cb);
            }),
        } as unknown as TelegramBotService;

        mockUsersApi = {
            findUserByChatId: vi.fn().mockResolvedValue(null),
        };

        handler = new StartHandler(botService, mockUsersApi as any);
    });

    describe('register', () => {
        it('should register /start command', () => {
            handler.register();

            expect(botService.onCommand).toHaveBeenCalledWith(
                TelegramCommand.Start,
                expect.any(Function),
            );
        });
    });

    describe('handle', () => {
        it('should enter connect-account scene for new user', async () => {
            handler.register();
            const ctx = createMockContext();
            mockUsersApi.findUserByChatId.mockResolvedValue(null);

            await registeredCallbacks.get(`cmd:${TelegramCommand.Start}`)!(ctx);

            expect(ctx.scene.enter).toHaveBeenCalledWith('connect_account');
        });

        it('should show welcome message for active user', async () => {
            handler.register();
            const ctx = createMockContext();
            mockUsersApi.findUserByChatId.mockResolvedValue({
                status: UserStatus.Active,
                accountAddress: '0xabc',
            });

            await registeredCallbacks.get(`cmd:${TelegramCommand.Start}`)!(ctx);

            expect(ctx.reply).toHaveBeenCalled();
            expect(ctx.scene.enter).not.toHaveBeenCalled();
        });
    });

    function createMockContext(): BotContext {
        return {
            chat: { id: 12345 },
            reply: vi.fn().mockResolvedValue(undefined),
            session: {},
            scene: {
                enter: vi.fn().mockResolvedValue(undefined),
            },
        } as unknown as BotContext;
    }
});
