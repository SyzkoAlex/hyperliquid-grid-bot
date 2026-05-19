import { describe, it, expect, vi, beforeEach, type Mocked } from 'vitest';
import { NotificationRouterService } from './notification-router.service';
import { OrderOpenedEvent } from '@domain/models/events/trading/order-opened.event';
import { UserStatus } from '@domain/models/user/user-status';
import { UserDto } from '@components/users/api/dto/user.dto';
import { UsersApiPort } from '@components/users/api/users-api.port';

const USER_ID = '660e8400-e29b-41d4-a716-446655440001';
const CHAT_ID = 123456789;
const GRID_ID = '550e8400-e29b-41d4-a716-446655440000';

function makeUserDto(overrides: Partial<UserDto> = {}): UserDto {
    return {
        id: USER_ID,
        telegramChatId: CHAT_ID,
        accountAddress: '0x1234567890123456789012345678901234567890',
        agentAddress: '0xagent',
        status: UserStatus.Active,
        timezone: 'UTC',
        tradeNotificationsEnabled: true,
        ...overrides,
    };
}

describe('NotificationRouterService', () => {
    let sut: NotificationRouterService;
    let mockUsersApi: Mocked<Pick<UsersApiPort, 'findUserById'>>;

    beforeEach(() => {
        mockUsersApi = {
            findUserById: vi.fn().mockResolvedValue(makeUserDto()),
        };
        sut = new NotificationRouterService(mockUsersApi as unknown as UsersApiPort);
    });

    describe('resolve', () => {
        it('returns route with chatId and tradeNotificationsEnabled when user found', async () => {
            const event = new OrderOpenedEvent(
                USER_ID,
                GRID_ID,
                'BTC',
                'buy',
                50000,
                0.1,
                5000,
                1,
                10,
            );

            const result = await sut.resolve(event);

            expect(result).toEqual({ chatId: CHAT_ID, tradeNotificationsEnabled: true });
            expect(mockUsersApi.findUserById).toHaveBeenCalledWith(USER_ID);
        });

        it('returns null when user not found', async () => {
            mockUsersApi.findUserById.mockResolvedValue(null);
            const event = new OrderOpenedEvent(
                USER_ID,
                GRID_ID,
                'BTC',
                'buy',
                50000,
                0.1,
                5000,
                1,
                10,
            );

            const result = await sut.resolve(event);

            expect(result).toBeNull();
        });

        it('propagates tradeNotificationsEnabled: false unchanged', async () => {
            mockUsersApi.findUserById.mockResolvedValue(
                makeUserDto({ tradeNotificationsEnabled: false }),
            );
            const event = new OrderOpenedEvent(
                USER_ID,
                GRID_ID,
                'BTC',
                'buy',
                50000,
                0.1,
                5000,
                1,
                10,
            );

            const result = await sut.resolve(event);

            expect(result).toEqual({ chatId: CHAT_ID, tradeNotificationsEnabled: false });
        });
    });
});
