import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HandleAgentExpiredUseCase } from './handle-agent-expired.use-case';
import { UserStatus } from '@domain/models/user/user-status';
import { AgentApprovalLostEvent } from '@domain/models/events/trading/agent-approval-lost.event';
import { UsersApiPort } from '@components/users/api/users-api.port';
import { EventPublisherPort } from '@/core/application/ports/outbound/event-publisher.port';
import { UserDto } from '@components/users/api/dto/user.dto';

const ACCOUNT_ADDRESS = '0xabc123';

function makeUserDto(status: UserStatus = UserStatus.Active): UserDto {
    return {
        id: 'user-1',
        telegramChatId: 12345,
        accountAddress: ACCOUNT_ADDRESS,
        agentAddress: '0xagent',
        status,
        timezone: 'UTC',
        tradeNotificationsEnabled: true,
    };
}

describe('HandleAgentExpiredUseCase', () => {
    let sut: HandleAgentExpiredUseCase;
    let mockUsersApi: {
        findUserByAccountAddress: ReturnType<typeof vi.fn>;
        markAgentExpired: ReturnType<typeof vi.fn>;
    };
    let mockPublisher: { publish: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        mockUsersApi = {
            findUserByAccountAddress: vi.fn().mockResolvedValue(makeUserDto()),
            markAgentExpired: vi.fn().mockResolvedValue({ agentAddress: '0xnewagent' }),
        };
        mockPublisher = {
            publish: vi.fn().mockResolvedValue(undefined),
        };

        sut = new HandleAgentExpiredUseCase(
            mockUsersApi as unknown as UsersApiPort,
            mockPublisher as unknown as EventPublisherPort,
        );
    });

    describe('handleAgentExpired — guard: skip if user not found', () => {
        it('does nothing when user is null', async () => {
            mockUsersApi.findUserByAccountAddress.mockResolvedValue(null);

            await sut.handleAgentExpired(ACCOUNT_ADDRESS);

            expect(mockUsersApi.markAgentExpired).not.toHaveBeenCalled();
            expect(mockPublisher.publish).not.toHaveBeenCalled();
        });
    });

    describe('handleAgentExpired — guard: skip if status is not Active', () => {
        it.each([UserStatus.PendingApproval, UserStatus.Disconnected, UserStatus.AgentExpired])(
            'does nothing when status is %s',
            async (status) => {
                mockUsersApi.findUserByAccountAddress.mockResolvedValue(makeUserDto(status));

                await sut.handleAgentExpired(ACCOUNT_ADDRESS);

                expect(mockUsersApi.markAgentExpired).not.toHaveBeenCalled();
                expect(mockPublisher.publish).not.toHaveBeenCalled();
            },
        );
    });

    describe('handleAgentExpired — happy path', () => {
        it('calls markAgentExpired with user id', async () => {
            await sut.handleAgentExpired(ACCOUNT_ADDRESS);

            expect(mockUsersApi.markAgentExpired).toHaveBeenCalledWith('user-1');
        });

        it('publishes AgentApprovalLostEvent with user id', async () => {
            await sut.handleAgentExpired(ACCOUNT_ADDRESS);

            expect(mockPublisher.publish).toHaveBeenCalledOnce();
            const event = mockPublisher.publish.mock.calls[0][0] as AgentApprovalLostEvent;
            expect(event).toBeInstanceOf(AgentApprovalLostEvent);
            expect(event.userId).toBe('user-1');
        });

        it('calls markAgentExpired before publishing event', async () => {
            await sut.handleAgentExpired(ACCOUNT_ADDRESS);

            const markOrder = mockUsersApi.markAgentExpired.mock.invocationCallOrder[0];
            const publishOrder = mockPublisher.publish.mock.invocationCallOrder[0];
            expect(markOrder).toBeLessThan(publishOrder);
        });
    });

    describe('handleAgentExpired — error propagation', () => {
        it('propagates error from markAgentExpired', async () => {
            mockUsersApi.markAgentExpired.mockRejectedValue(new Error('DB error'));

            await expect(sut.handleAgentExpired(ACCOUNT_ADDRESS)).rejects.toThrow('DB error');
        });
    });
});
