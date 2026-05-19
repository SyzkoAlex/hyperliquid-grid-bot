import { describe, it, expect, vi, beforeEach, type Mocked } from 'vitest';
import { NotifyUserUseCase } from './notify-user.use-case';
import { OrderOpenedEvent } from '@domain/models/events/trading/order-opened.event';
import { NotificationRoute } from '@components/telegram/core/application/services/notification-router/types/notification-route';
import { TelegramNotificationPort } from '@components/telegram/core/application/ports/telegram-notification.port';
import { NotificationMessageFactory } from '@components/telegram/core/domain/models/messages/notifications/notification-message.factory';
import { NotificationRouterService } from '@components/telegram/core/application/services/notification-router/notification-router.service';

const CHAT_ID = 123456789;
const GRID_ID = '550e8400-e29b-41d4-a716-446655440000';
const USER_ID = '660e8400-e29b-41d4-a716-446655440001';

function makeRoute(overrides: Partial<NotificationRoute> = {}): NotificationRoute {
    return {
        chatId: CHAT_ID,
        tradeNotificationsEnabled: true,
        ...overrides,
    };
}

describe('NotifyUserUseCase', () => {
    let sut: NotifyUserUseCase;
    let mockTelegramNotification: Mocked<TelegramNotificationPort>;
    let mockMessageFactory: Mocked<Pick<NotificationMessageFactory, 'buildFromEvent'>>;
    let mockRouter: Mocked<Pick<NotificationRouterService, 'resolve'>>;

    beforeEach(() => {
        mockTelegramNotification = {
            sendMessage: vi.fn().mockResolvedValue(undefined),
        };
        mockMessageFactory = {
            buildFromEvent: vi.fn().mockReturnValue({ text: 'notification text' }),
        };
        mockRouter = {
            resolve: vi.fn().mockResolvedValue(makeRoute()),
        };
        sut = new NotifyUserUseCase(
            mockTelegramNotification,
            mockMessageFactory as unknown as NotificationMessageFactory,
            mockRouter as unknown as NotificationRouterService,
        );
    });

    describe('execute', () => {
        it('should not call sendMessage when router returns null', async () => {
            mockRouter.resolve.mockResolvedValue(null);
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
            mockRouter.resolve.mockResolvedValue(makeRoute({ tradeNotificationsEnabled: false }));
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
    });
});
