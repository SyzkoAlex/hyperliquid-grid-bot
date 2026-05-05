import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VerifyApprovalStep } from './verify-approval.step';
import { BotContext } from '../../../types/bot-context';
import { ConnectAccountMessages } from '@components/telegram/core/domain/models/messages/wizard/connect-account.messages';

const MOCK_USER_ID = '00000000-0000-0000-0000-000000000001';
const MOCK_ACCOUNT_ADDRESS = '0x1234567890123456789012345678901234567890';

function makeCtx(userId?: string, accountAddress?: string): BotContext {
    return {
        reply: vi.fn().mockResolvedValue(undefined),
        session: {
            connectAccount: userId && accountAddress ? { userId, accountAddress } : undefined,
        },
        scene: { leave: vi.fn().mockResolvedValue(undefined) },
    } as unknown as BotContext;
}

describe('VerifyApprovalStep', () => {
    let sut: VerifyApprovalStep;

    let mockVerifyAgentUseCase: {
        execute: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        mockVerifyAgentUseCase = {
            execute: vi.fn().mockResolvedValue({ success: true }),
        };

        sut = new VerifyApprovalStep(mockVerifyAgentUseCase as any);
    });

    describe('execute', () => {
        it('should leave scene with session-expired message when session state is missing', async () => {
            const ctx = makeCtx(undefined, undefined);

            await sut.execute(ctx);

            expect(ctx.reply).toHaveBeenCalledWith(ConnectAccountMessages.SESSION_EXPIRED);
            expect(ctx.scene.leave).toHaveBeenCalled();
            expect(mockVerifyAgentUseCase.execute).not.toHaveBeenCalled();
        });

        it('should call verifyAgentUseCase.execute with the userId from session', async () => {
            const ctx = makeCtx(MOCK_USER_ID, MOCK_ACCOUNT_ADDRESS);

            await sut.execute(ctx);

            expect(mockVerifyAgentUseCase.execute).toHaveBeenCalledWith(MOCK_USER_ID);
        });

        it('should show success message and leave scene when approval succeeds', async () => {
            mockVerifyAgentUseCase.execute.mockResolvedValue({ success: true });
            const ctx = makeCtx(MOCK_USER_ID, MOCK_ACCOUNT_ADDRESS);

            await sut.execute(ctx);

            expect(ctx.scene.leave).toHaveBeenCalled();
            // reply is called twice: verifying + success
            expect(ctx.reply).toHaveBeenCalledTimes(2);
            expect(ctx.reply).toHaveBeenNthCalledWith(
                2,
                ConnectAccountMessages.approvalSuccess(),
                expect.any(Object),
            );
        });

        it('should clear session connectAccount on approval success', async () => {
            mockVerifyAgentUseCase.execute.mockResolvedValue({ success: true });
            const ctx = makeCtx(MOCK_USER_ID, MOCK_ACCOUNT_ADDRESS);

            await sut.execute(ctx);

            expect(ctx.session.connectAccount).toBeUndefined();
        });

        it('should show retry prompt and NOT leave scene when approval fails', async () => {
            mockVerifyAgentUseCase.execute.mockResolvedValue({ success: false });
            const ctx = makeCtx(MOCK_USER_ID, MOCK_ACCOUNT_ADDRESS);

            await sut.execute(ctx);

            expect(ctx.scene.leave).not.toHaveBeenCalled();
            // reply is called twice: verifying + failed
            expect(ctx.reply).toHaveBeenCalledTimes(2);
            expect(ctx.reply).toHaveBeenNthCalledWith(
                2,
                ConnectAccountMessages.approvalFailed(),
                expect.any(Object),
            );
        });
    });
});
