import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApproveAgentStep } from './approve-agent.step';
import { BotContext } from '../../../types/bot-context';
import { ConnectAccountSceneStep } from '../connect-account-scene-step';
import { UserStatus } from '@domain/models/user/user-status';

const MOCK_USER_ID = '00000000-0000-0000-0000-000000000001';
const MOCK_CHAT_ID = 123456789;
const MOCK_ACCOUNT_ADDRESS = '0x1234567890123456789012345678901234567890';
const MOCK_AGENT_ADDRESS = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';

const mockUserDto = {
    id: MOCK_USER_ID,
    telegramChatId: MOCK_CHAT_ID,
    accountAddress: MOCK_ACCOUNT_ADDRESS,
    agentAddress: MOCK_AGENT_ADDRESS,
    status: UserStatus.PendingApproval,
};

function makeConfigService(testnet = true) {
    return {
        get: vi.fn().mockReturnValue({ testnet }),
    };
}

function makeCtx(accountAddress?: string): BotContext {
    return {
        reply: vi.fn().mockResolvedValue(undefined),
        session: {
            connectAccount: accountAddress ? { accountAddress } : {},
        },
        chat: { id: MOCK_CHAT_ID },
        scene: { leave: vi.fn().mockResolvedValue(undefined) },
    } as unknown as BotContext;
}

describe('ApproveAgentStep', () => {
    let sut: ApproveAgentStep;

    let mockConnectAccountUseCase: {
        execute: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        mockConnectAccountUseCase = {
            execute: vi
                .fn()
                .mockResolvedValue({ user: mockUserDto, agentAddress: MOCK_AGENT_ADDRESS }),
        };

        sut = new ApproveAgentStep(
            mockConnectAccountUseCase as any,
            makeConfigService(true) as any,
        );
    });

    describe('enter', () => {
        it('should leave scene when session has no accountAddress', async () => {
            const ctx = makeCtx(undefined);
            ctx.session.connectAccount = {};

            await sut.enter(ctx);

            expect(ctx.scene.leave).toHaveBeenCalled();
            expect(mockConnectAccountUseCase.execute).not.toHaveBeenCalled();
        });

        it('should call connectAccountUseCase.execute with chatId and accountAddress', async () => {
            const ctx = makeCtx(MOCK_ACCOUNT_ADDRESS);

            await sut.enter(ctx);

            expect(mockConnectAccountUseCase.execute).toHaveBeenCalledWith(
                MOCK_CHAT_ID,
                MOCK_ACCOUNT_ADDRESS,
            );
        });

        it('should set userId and agentAddress in session state', async () => {
            const ctx = makeCtx(MOCK_ACCOUNT_ADDRESS);

            await sut.enter(ctx);

            expect(ctx.session.connectAccount!.userId).toBe(MOCK_USER_ID);
            expect(ctx.session.connectAccount!.agentAddress).toBe(MOCK_AGENT_ADDRESS);
            expect(ctx.session.connectAccount!.currentStep).toBe(
                ConnectAccountSceneStep.ApproveAgent,
            );
        });

        it('should reply with agent approval message', async () => {
            const ctx = makeCtx(MOCK_ACCOUNT_ADDRESS);

            await sut.enter(ctx);

            expect(ctx.reply).toHaveBeenCalledOnce();
        });
    });
});
