import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsHandler } from './settings.handler';
import { TelegramBotService } from '../../telegram-bot.service';
import { BotContext } from '../../types/bot-context';
import { TelegramAction } from '@components/telegram/core/domain/models/telegram-action';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels';
import { TelegramParseMode } from '@components/telegram/core/domain/models/telegram-parse-mode';
import { UsersApiPort } from '@components/users/api/users-api.port';
import { UserStatus } from '@domain/models/user/user-status';
import { UserDto } from '@components/users/api/dto/user.dto';

const MOCK_USER: UserDto = {
    id: 'user-id-123',
    telegramChatId: 100000001,
    accountAddress: '0xtest',
    agentAddress: '0xagent',
    status: UserStatus.Active,
    timezone: 'UTC',
    tradeNotificationsEnabled: true,
};

describe('SettingsHandler', () => {
    let handler: SettingsHandler;
    let botService: TelegramBotService;
    let usersApi: UsersApiPort;
    let hearsCallbacks: Map<string, (ctx: BotContext) => Promise<void>>;
    let actionCallbacks: Map<string, (ctx: BotContext) => Promise<void>>;

    beforeEach(() => {
        hearsCallbacks = new Map();
        actionCallbacks = new Map();

        botService = {
            onHears: vi.fn((text: string, cb: (ctx: BotContext) => Promise<void>) => {
                hearsCallbacks.set(text, cb);
            }),
            onAction: vi.fn((action: string, cb: (ctx: BotContext) => Promise<void>) => {
                actionCallbacks.set(String(action), cb);
            }),
        } as unknown as TelegramBotService;

        usersApi = {
            updateTradeNotificationsEnabled: vi.fn().mockResolvedValue(undefined),
        } as unknown as UsersApiPort;

        handler = new SettingsHandler(botService, usersApi);
    });

    describe('register', () => {
        it('registers hears, ShowSettings action, and ToggleTradeNotifications action', () => {
            handler.register();

            expect(botService.onHears).toHaveBeenCalledWith(
                BUTTON_LABELS.SETTINGS,
                expect.any(Function),
            );
            expect(botService.onAction).toHaveBeenCalledWith(
                TelegramAction.ShowSettings,
                expect.any(Function),
            );
            expect(botService.onAction).toHaveBeenCalledWith(
                TelegramAction.ToggleTradeNotifications,
                expect.any(Function),
            );
        });
    });

    describe('handle (hears)', () => {
        it('replies with settings message and inline keyboard for active user', async () => {
            handler.register();
            const ctx = createMockContext({ tradeNotificationsEnabled: true });

            await hearsCallbacks.get(BUTTON_LABELS.SETTINGS)!(ctx);

            expect(ctx.reply).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ parse_mode: TelegramParseMode.HTML }),
            );
        });

        it('sends connect CTA for non-active user and does not touch usersApi', async () => {
            handler.register();
            const ctx = createNonActiveContext();

            await hearsCallbacks.get(BUTTON_LABELS.SETTINGS)!(ctx);

            expect(ctx.reply).toHaveBeenCalled();
            expect(usersApi.updateTradeNotificationsEnabled).not.toHaveBeenCalled();
        });
    });

    describe('handleShow (action ShowSettings)', () => {
        it('calls answerCbQuery then editMessageText for active user', async () => {
            handler.register();
            const ctx = createMockContext({ tradeNotificationsEnabled: true });

            await actionCallbacks.get(TelegramAction.ShowSettings)!(ctx);

            expect(ctx.answerCbQuery).toHaveBeenCalled();
            expect(ctx.editMessageText).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ parse_mode: TelegramParseMode.HTML }),
            );
        });
    });

    describe('handleToggle (action ToggleTradeNotifications)', () => {
        it('toggles from true to false: calls updateTradeNotificationsEnabled with false and edits to OFF state', async () => {
            handler.register();
            const ctx = createMockContext({ tradeNotificationsEnabled: true });

            await actionCallbacks.get(TelegramAction.ToggleTradeNotifications)!(ctx);

            expect(usersApi.updateTradeNotificationsEnabled).toHaveBeenCalledWith(
                'user-id-123',
                false,
            );
            const editCall = (ctx.editMessageText as ReturnType<typeof vi.fn>).mock.calls[0];
            expect(editCall[0]).toContain('OFF');
        });

        it('toggles from false to true: calls updateTradeNotificationsEnabled with true and edits to ON state', async () => {
            handler.register();
            const ctx = createMockContext({ tradeNotificationsEnabled: false });

            await actionCallbacks.get(TelegramAction.ToggleTradeNotifications)!(ctx);

            expect(usersApi.updateTradeNotificationsEnabled).toHaveBeenCalledWith(
                'user-id-123',
                true,
            );
            const editCall = (ctx.editMessageText as ReturnType<typeof vi.fn>).mock.calls[0];
            expect(editCall[0]).toContain('ON');
        });

        it('does not call updateTradeNotificationsEnabled for non-active user', async () => {
            handler.register();
            const ctx = createNonActiveContext();

            await actionCallbacks.get(TelegramAction.ToggleTradeNotifications)!(ctx);

            expect(usersApi.updateTradeNotificationsEnabled).not.toHaveBeenCalled();
        });
    });

    function createMockContext(userOverrides: Partial<UserDto> = {}): BotContext {
        return {
            reply: vi.fn(),
            answerCbQuery: vi.fn(),
            editMessageText: vi.fn(),
            user: { ...MOCK_USER, ...userOverrides },
        } as unknown as BotContext;
    }

    function createNonActiveContext(): BotContext {
        return {
            reply: vi.fn(),
            answerCbQuery: vi.fn(),
            editMessageText: vi.fn(),
            user: undefined,
        } as unknown as BotContext;
    }
});
