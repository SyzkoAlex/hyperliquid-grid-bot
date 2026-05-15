import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StartHandler } from './start.handler';
import { TelegramBotService } from '../../telegram-bot.service';
import { BotContext } from '../../types/bot-context';
import { TelegramCommand } from '@components/telegram/core/domain/models/telegram-command';
import { UserStatus } from '@domain/models/user/user-status';
import { LandingMessage } from '@components/telegram/core/domain/models/messages/landing-message';
import { UserDto } from '@components/users/api/dto/user.dto';
import { ActiveGridsViewBuilder } from '@components/telegram/core/application/services/active-grids-view-builder/active-grids-view-builder.service';

describe('StartHandler', () => {
    let handler: StartHandler;
    let botService: TelegramBotService;
    let viewBuilder: ActiveGridsViewBuilder;
    let registeredCallbacks: Map<string, (ctx: BotContext) => Promise<void>>;

    beforeEach(() => {
        registeredCallbacks = new Map();

        botService = {
            onCommand: vi.fn((cmd: string, cb: (ctx: BotContext) => Promise<void>) => {
                registeredCallbacks.set(`cmd:${cmd}`, cb);
            }),
        } as unknown as TelegramBotService;

        viewBuilder = {
            build: vi.fn().mockResolvedValue({ text: '', keyboard: [], totalCount: 0 }),
            buildWithGreeting: vi.fn().mockResolvedValue({ text: '', keyboard: [], totalCount: 0 }),
        } as unknown as ActiveGridsViewBuilder;

        handler = new StartHandler(botService, viewBuilder);
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
        it('should send one landing reply with reply menu for new user (null)', async () => {
            handler.register();
            const ctx = createMockContext();

            await registeredCallbacks.get(`cmd:${TelegramCommand.Start}`)!(ctx);

            expect(ctx.reply).toHaveBeenCalledTimes(1);
            const [text, options] = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0];
            expect(text).toBe(LandingMessage.create().text);
            expect(options.reply_markup).toHaveProperty('keyboard');
            expect(options.reply_markup).not.toHaveProperty('inline_keyboard');
            expect(ctx.scene.enter).not.toHaveBeenCalled();
        });

        it('should send one landing reply with reply menu for disconnected user', async () => {
            handler.register();
            const ctx = createMockContext(makeUser(UserStatus.Disconnected));

            await registeredCallbacks.get(`cmd:${TelegramCommand.Start}`)!(ctx);

            expect(ctx.reply).toHaveBeenCalledTimes(1);
            const [, options] = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0];
            expect(options.reply_markup).toHaveProperty('keyboard');
            expect(ctx.scene.enter).not.toHaveBeenCalled();
        });

        it('should send landing message text for new user (no ctx.user)', async () => {
            handler.register();
            const ctx = createMockContext();

            await registeredCallbacks.get(`cmd:${TelegramCommand.Start}`)!(ctx);

            expect(ctx.reply).toHaveBeenCalledWith(LandingMessage.create().text, expect.anything());
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

        it('should show EmptyGridsMessage with username when active user has no grids', async () => {
            vi.mocked(viewBuilder.buildWithGreeting).mockResolvedValue({
                text: '',
                keyboard: [],
                totalCount: 0,
            });
            handler.register();
            const ctx = createMockContext(makeUser(UserStatus.Active), 'alice');

            await registeredCallbacks.get(`cmd:${TelegramCommand.Start}`)!(ctx);

            expect(viewBuilder.buildWithGreeting).toHaveBeenCalledWith(1, 'alice');
            expect(ctx.reply).toHaveBeenCalledTimes(1);
            const [text, options] = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0];
            expect(text).toContain('Welcome back, @alice!');
            expect(text).toContain('Create Grid');
            expect(options.reply_markup).toHaveProperty('keyboard');
        });

        it('should show EmptyGridsMessage without @ when active user has no grids and no username', async () => {
            vi.mocked(viewBuilder.buildWithGreeting).mockResolvedValue({
                text: '',
                keyboard: [],
                totalCount: 0,
            });
            handler.register();
            const ctx = createMockContext(makeUser(UserStatus.Active));

            await registeredCallbacks.get(`cmd:${TelegramCommand.Start}`)!(ctx);

            expect(viewBuilder.buildWithGreeting).toHaveBeenCalledWith(1, undefined);
            const [text] = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0];
            expect(text).toContain('Welcome back!');
            expect(text).not.toContain('@');
        });

        it('should show greeting + grid list when active user has grids', async () => {
            vi.mocked(viewBuilder.buildWithGreeting).mockResolvedValue({
                text: 'Welcome back, @alice!\n\n<b>Active Grids</b> (3)',
                keyboard: [[{ text: 'Details', action: 'view:grid:abc' }]],
                totalCount: 3,
            });
            handler.register();
            const ctx = createMockContext(makeUser(UserStatus.Active), 'alice');

            await registeredCallbacks.get(`cmd:${TelegramCommand.Start}`)!(ctx);

            expect(ctx.reply).toHaveBeenCalledTimes(1);
            const [text, options] = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0];
            expect(text).toContain('Welcome back, @alice!');
            expect(text).toContain('<b>Active Grids</b> (3)');
            expect(options.reply_markup).toHaveProperty('inline_keyboard');
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

    function createMockContext(user?: UserDto, username?: string): BotContext {
        return {
            chat: { id: 12345 },
            from: username ? { username } : undefined,
            reply: vi.fn().mockResolvedValue({ message_id: 1 }),
            deleteMessage: vi.fn().mockResolvedValue(undefined),
            session: {},
            scene: {
                enter: vi.fn().mockResolvedValue(undefined),
            },
            user,
        } as unknown as BotContext;
    }
});
