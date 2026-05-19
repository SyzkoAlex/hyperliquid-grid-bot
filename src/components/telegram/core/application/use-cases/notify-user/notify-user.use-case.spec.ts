import { describe, it, expect, vi, beforeEach, type Mocked } from 'vitest';
import { NotifyUserUseCase } from './notify-user.use-case';
import { OrderOpenedEvent } from '@domain/models/events/trading/order-opened.event';
import { TelegramNotificationPort } from '@components/telegram/core/application/ports/telegram-notification.port';
import { NotificationMessageFactory } from '@components/telegram/core/domain/models/messages/notifications/notification-message.factory';
import { UsersApiPort } from '@components/users/api/users-api.port';
import { UserDto } from '@components/users/api/dto/user.dto';
import { UserStatus } from '@domain/models/user/user-status';

const CHAT_ID = 123456789;
const GRID_ID = '550e8400-e29b-41d4-a716-446655440000';
const USER_ID = '660e8400-e29b-41d4-a716-446655440001';

function makeUser(overrides: Partial<UserDto> = {}): UserDto {
    return {
        id: USER_ID,
        telegramChatId: CHAT_ID,
        accountAddress: '0xabc',
        agentAddress: '0xagent',
        status: UserStatus.Active,
        timezone: 'UTC',
        tradeNotificationsEnabled: true,
        ...overrides,
    };
}

describe('NotifyUserUseCase', () => {
    let sut: NotifyUserUseCase;
    let mockTelegramNotification: Mocked<TelegramNotificationPort>;
    let mockMessageFactory: Mocked<Pick<NotificationMessageFactory, 'buildFromEvent'>>;
    let mockUsersApi: Mocked<UsersApiPort>;

    beforeEach(() => {
        mockTelegramNotification = {
            sendMessage: vi.fn().mockResolvedValue(undefined),
        };
        mockMessageFactory = {
            buildFromEvent: vi.fn().mockReturnValue({ text: 'notification text' }),
        };
        mockUsersApi = {
            findUserById: vi.fn().mockResolvedValue(makeUser()),
            findUserByChatId: vi.fn().mockResolvedValue(null),
            findUserByAccountAddress: vi.fn().mockResolvedValue(null),
            findActiveUsers: vi.fn().mockResolvedValue([]),
            getAgentPrivateKey: vi.fn().mockResolvedValue(''),
            createPendingUser: vi.fn().mockResolvedValue({ user: makeUser(), agentAddress: '' }),
            activateUser: vi.fn().mockResolvedValue(undefined),
            disconnectUser: vi.fn().mockResolvedValue(undefined),
            updateTradeNotificationsEnabled: vi.fn().mockResolvedValue(undefined),
        };
        sut = new NotifyUserUseCase(
            mockTelegramNotification,
            mockMessageFactory as unknown as NotificationMessageFactory,
            mockUsersApi,
        );
    });

    describe('execute', () => {
        it('should not call sendMessage when user not found', async () => {
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

            await sut.execute({ event });

            expect(mockTelegramNotification.sendMessage).not.toHaveBeenCalled();
        });

        it('should not call sendMessage when tradeNotificationsEnabled is false', async () => {
            mockUsersApi.findUserById.mockResolvedValue(
                makeUser({ tradeNotificationsEnabled: false }),
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

            await sut.execute({ event });

            expect(mockTelegramNotification.sendMessage).not.toHaveBeenCalled();
        });

        it('should call sendMessage with chatId and text when notifications are enabled', async () => {
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

            await sut.execute({ event });

            expect(mockTelegramNotification.sendMessage).toHaveBeenCalledWith(
                CHAT_ID,
                'notification text',
            );
        });

        it('should build the message text using the factory', async () => {
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

            await sut.execute({ event });

            expect(mockMessageFactory.buildFromEvent).toHaveBeenCalledWith(event);
        });

        it('should look up user by event.userId', async () => {
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

            await sut.execute({ event });

            expect(mockUsersApi.findUserById).toHaveBeenCalledWith(USER_ID);
        });
    });
});
