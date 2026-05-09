import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectAccountHandler } from './connect-account.handler';
import { TelegramBotService } from '../../telegram-bot.service';
import { BotContext } from '../../types/bot-context';
import { TelegramAction } from '@components/telegram/core/domain/models/telegram-action';
import { UserStatus } from '@domain/models/user/user-status';
import { CONNECT_ACCOUNT_SCENE_ID } from '../../scenes/connect-account/connect-account.scene';
import { UsersApiPort } from '@components/users/api/users-api.port';

describe('ConnectAccountHandler', () => {
    let handler: ConnectAccountHandler;
    let botService: TelegramBotService;
    let mockUsersApi: { findUserByChatId: ReturnType<typeof vi.fn> };
    let actionCallbacks: Map<string, (ctx: BotContext) => Promise<void>>;

    beforeEach(() => {
        actionCallbacks = new Map();

        botService = {
            onAction: vi.fn((action: string, cb: (ctx: BotContext) => Promise<void>) => {
                actionCallbacks.set(String(action), cb);
            }),
        } as unknown as TelegramBotService;

        mockUsersApi = {
            findUserByChatId: vi.fn().mockResolvedValue(null),
        };

        handler = new ConnectAccountHandler(botService, mockUsersApi as unknown as UsersApiPort);
    });

    describe('register', () => {
        it('should register ConnectAccount action callback', () => {
            handler.register();

            expect(botService.onAction).toHaveBeenCalledWith(
                TelegramAction.ConnectAccount,
                expect.any(Function),
            );
        });
    });

    describe('handle', () => {
        it('should enter connect-account scene for non-PendingApproval user without pre-populating session', async () => {
            handler.register();
            const ctx = createMockContext();
            mockUsersApi.findUserByChatId.mockResolvedValue(null);

            await actionCallbacks.get(TelegramAction.ConnectAccount)!(ctx);

            expect(ctx.answerCbQuery).toHaveBeenCalled();
            expect(ctx.session.connectAccount).toBeUndefined();
            expect(ctx.scene.enter).toHaveBeenCalledWith(CONNECT_ACCOUNT_SCENE_ID);
        });

        it('should pre-populate session and enter scene for PendingApproval user', async () => {
            handler.register();
            const ctx = createMockContext();
            mockUsersApi.findUserByChatId.mockResolvedValue({
                status: UserStatus.PendingApproval,
                accountAddress: '0xabc',
                id: 'user-1',
                agentAddress: '0xagent',
            });

            await actionCallbacks.get(TelegramAction.ConnectAccount)!(ctx);

            expect(ctx.answerCbQuery).toHaveBeenCalled();
            expect(ctx.session.connectAccount).toEqual({
                accountAddress: '0xabc',
                userId: 'user-1',
                agentAddress: '0xagent',
            });
            expect(ctx.scene.enter).toHaveBeenCalledWith(CONNECT_ACCOUNT_SCENE_ID);
        });

        it('should return early when chatId is missing', async () => {
            handler.register();
            const ctx = createMockContext({ chatId: undefined });

            await actionCallbacks.get(TelegramAction.ConnectAccount)!(ctx);

            expect(ctx.answerCbQuery).toHaveBeenCalled();
            expect(mockUsersApi.findUserByChatId).not.toHaveBeenCalled();
            expect(ctx.scene.enter).not.toHaveBeenCalled();
        });
    });

    function createMockContext(opts?: { chatId?: number }): BotContext {
        const chatId = opts !== undefined ? opts.chatId : 12345;
        return {
            chat: chatId !== undefined ? { id: chatId } : undefined,
            answerCbQuery: vi.fn().mockResolvedValue(undefined),
            session: {},
            scene: {
                enter: vi.fn().mockResolvedValue(undefined),
            },
        } as unknown as BotContext;
    }
});
