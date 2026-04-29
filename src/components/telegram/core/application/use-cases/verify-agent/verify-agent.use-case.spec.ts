import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VerifyAgentUseCase } from './verify-agent.use-case';
import { UserStatus } from '@domain/models/user/user-status';

const MOCK_USER_ID = '00000000-0000-0000-0000-000000000001';
const MOCK_ACCOUNT_ADDRESS = '0x1234567890123456789012345678901234567890';
const MOCK_AGENT_ADDRESS = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';

const mockUserDto = {
    id: MOCK_USER_ID,
    telegramChatId: 123456,
    accountAddress: MOCK_ACCOUNT_ADDRESS,
    agentAddress: MOCK_AGENT_ADDRESS,
    status: UserStatus.PendingApproval,
};

describe('VerifyAgentUseCase', () => {
    let sut: VerifyAgentUseCase;

    let mockUsersApi: {
        findUserById: ReturnType<typeof vi.fn>;
        activateUser: ReturnType<typeof vi.fn>;
    };

    let mockTradingApi: {
        probeAgentApproval: ReturnType<typeof vi.fn>;
        notifyAgentActivated: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        mockUsersApi = {
            findUserById: vi.fn().mockResolvedValue(mockUserDto),
            activateUser: vi.fn().mockResolvedValue(undefined),
        };

        mockTradingApi = {
            probeAgentApproval: vi.fn().mockResolvedValue({ approved: true }),
            notifyAgentActivated: vi.fn(),
        };

        sut = new VerifyAgentUseCase(mockUsersApi as any, mockTradingApi as any);
    });

    describe('execute', () => {
        it('should activate user and return success when probeAgentApproval returns approved: true', async () => {
            mockTradingApi.probeAgentApproval.mockResolvedValue({ approved: true });

            const result = await sut.execute(MOCK_USER_ID);

            expect(result).toEqual({ success: true });
            expect(mockTradingApi.probeAgentApproval).toHaveBeenCalledWith(MOCK_ACCOUNT_ADDRESS);
            expect(mockUsersApi.activateUser).toHaveBeenCalledWith(MOCK_USER_ID);
            expect(mockTradingApi.notifyAgentActivated).toHaveBeenCalledWith(MOCK_ACCOUNT_ADDRESS);
        });

        it('should NOT activate user and return failure when probeAgentApproval returns approved: false', async () => {
            mockTradingApi.probeAgentApproval.mockResolvedValue({ approved: false });

            const result = await sut.execute(MOCK_USER_ID);

            expect(result).toEqual({ success: false });
            expect(mockUsersApi.activateUser).not.toHaveBeenCalled();
            expect(mockTradingApi.notifyAgentActivated).not.toHaveBeenCalled();
        });

        it('should return failure when user is not found', async () => {
            mockUsersApi.findUserById.mockResolvedValue(null);

            const result = await sut.execute(MOCK_USER_ID);

            expect(result).toEqual({ success: false });
            expect(mockTradingApi.probeAgentApproval).not.toHaveBeenCalled();
            expect(mockUsersApi.activateUser).not.toHaveBeenCalled();
        });
    });
});
