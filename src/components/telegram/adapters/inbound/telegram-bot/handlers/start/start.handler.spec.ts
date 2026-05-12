import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StartHandler } from './start.handler';
import { TelegramBotService } from '../../telegram-bot.service';
import { BotContext } from '../../types/bot-context';
import { TelegramCommand } from '@components/telegram/core/domain/models/telegram-command';
import { UserStatus } from '@domain/models/user/user-status';
import { WelcomeMessage } from '@components/telegram/core/domain/models/messages/welcome-message';
import { LandingMessage } from '@components/telegram/core/domain/models/messages/landing-message';
import { UserDto } from '@components/users/api/dto/user.dto';

describe('StartHandler', () => {
    let handler: StartHandler;
    let botService: TelegramBotService;
    let registeredCallbacks: Map<string, (ctx: BotContext) => Promise<void>>;

    beforeEach(() => {
        registeredCallbacks = new Map();

        botService = {
            onCommand: vi.fn((cmd: string, cb: (ctx: BotContext) => Promise<void>) => {
                registeredCallbacks.set(`cmd:${cmd}`, cb);
            }),
        } as unknown as TelegramBotService;

        handler = new StartHandler(botService);
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
        it('should send two replies for new user: removeKeyboard then landing with inline CTA', async () => {
            handler.register();
            const ctx = createMockContext();

            await registeredCallbacks.get(`cmd:${TelegramCommand.Start}`)!(ctx);

            expect(ctx.reply).toHaveBeenCalledTimes(2);
            // First call removes the persistent reply keyboard
            const [firstCall, secondCall] = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls;
            expect(firstCall[1]).toMatchObject({ reply_markup: { remove_keyboard: true } });
            // Second call sends the landing text with the inline CTA keyboard
            expect(secondCall[0]).toContain(LandingMessage.create().text.substring(0, 20));
            expect(secondCall[1]).toMatchObject({
                reply_markup: { inline_keyboard: expect.any(Array) },
            });
            expect(ctx.scene.enter).not.toHaveBeenCalled();
        });

        it('should show landing message for new user (no ctx.user)', async () => {
            handler.register();
            const ctx = createMockContext();

            await registeredCallbacks.get(`cmd:${TelegramCommand.Start}`)!(ctx);

            expect(ctx.reply).toHaveBeenCalledWith(LandingMessage.create().text, expect.anything());
            expect(ctx.scene.enter).not.toHaveBeenCalled();
        });

        it('should show landing message for disconnected user', async () => {
            handler.register();
            const ctx = createMockContext(makeUser(UserStatus.Disconnected));

            await registeredCallbacks.get(`cmd:${TelegramCommand.Start}`)!(ctx);

            expect(ctx.reply).toHaveBeenCalledTimes(2);
            expect(ctx.scene.enter).not.toHaveBeenCalled();
        });

        it('should show welcome message for active user', async () => {
            handler.register();
            const ctx = createMockContext(makeUser(UserStatus.Active));

            await registeredCallbacks.get(`cmd:${TelegramCommand.Start}`)!(ctx);

            expect(ctx.reply).toHaveBeenCalledWith(WelcomeMessage.create().text, expect.anything());
            expect(ctx.scene.enter).not.toHaveBeenCalled();
        });

        it('should resume connect-account scene for pending approval user', async () => {
            handler.register();
            const ctx = createMockContext(makeUser(UserStatus.PendingApproval));

            await registeredCallbacks.get(`cmd:${TelegramCommand.Start}`)!(ctx);

            expect(ctx.session.connectAccount).toEqual({
                accountAddress: '0xabc',
                userId: 'user-1',
                agentAddress: '0xagent',
            });
            expect(ctx.scene.enter).toHaveBeenCalledWith('connect_account');
            expect(ctx.reply).not.toHaveBeenCalled();
        });
    });

    function makeUser(status: UserStatus): UserDto {
        return {
            id: 'user-1',
            telegramChatId: 12345,
            accountAddress: '0xabc',
            agentAddress: '0xagent',
            status,
            timezone: 'UTC',
        };
    }

    function createMockContext(user?: UserDto): BotContext {
        return {
            chat: { id: 12345 },
            reply: vi.fn().mockResolvedValue(undefined),
            session: {},
            scene: {
                enter: vi.fn().mockResolvedValue(undefined),
            },
            user,
        } as unknown as BotContext;
    }
});
