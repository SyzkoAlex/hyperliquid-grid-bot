import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectAccountHandler } from './connect-account.handler';
import { TelegramBotService } from '../../telegram-bot.service';
import { BotContext } from '../../types/bot-context';
import { TelegramAction } from '@components/telegram/core/domain/models/telegram-action';
import { UserStatus } from '@domain/models/user/user-status';
import { CONNECT_ACCOUNT_SCENE_ID } from '../../scenes/connect-account/connect-account.scene';

describe('ConnectAccountHandler', () => {
    let handler: ConnectAccountHandler;
    let botService: TelegramBotService;
    let actionCallbacks: Map<string, (ctx: BotContext) => Promise<void>>;

    beforeEach(() => {
        actionCallbacks = new Map();

        botService = {
            onAction: vi.fn((action: string, cb: (ctx: BotContext) => Promise<void>) => {
                actionCallbacks.set(String(action), cb);
            }),
        } as unknown as TelegramBotService;

        handler = new ConnectAccountHandler(botService);
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
        it('should enter connect-account scene when user is not PendingApproval', async () => {
            handler.register();
            const ctx = createMockContext();

            await actionCallbacks.get(TelegramAction.ConnectAccount)!(ctx);

            expect(ctx.answerCbQuery).toHaveBeenCalled();
            expect(ctx.session.connectAccount).toBeUndefined();
            expect(ctx.scene.enter).toHaveBeenCalledWith(CONNECT_ACCOUNT_SCENE_ID);
        });

        it('should pre-populate session and enter scene for PendingApproval user', async () => {
            handler.register();
            const ctx = createMockContext({
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

        it('should pre-populate session and enter scene for AgentExpired user', async () => {
            handler.register();
            const ctx = createMockContext({
                status: UserStatus.AgentExpired,
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

        it('should enter scene when ctx.user is undefined (unregistered)', async () => {
            handler.register();
            const ctx = createMockContext(undefined);

            await actionCallbacks.get(TelegramAction.ConnectAccount)!(ctx);

            expect(ctx.answerCbQuery).toHaveBeenCalled();
            expect(ctx.session.connectAccount).toBeUndefined();
            expect(ctx.scene.enter).toHaveBeenCalledWith(CONNECT_ACCOUNT_SCENE_ID);
        });
    });

    function createMockContext(user?: {
        status: UserStatus;
        accountAddress: string;
        id: string;
        agentAddress: string;
    }): BotContext {
        return {
            answerCbQuery: vi.fn().mockResolvedValue(undefined),
            session: {},
            scene: {
                enter: vi.fn().mockResolvedValue(undefined),
            },
            user,
        } as unknown as BotContext;
    }
});
