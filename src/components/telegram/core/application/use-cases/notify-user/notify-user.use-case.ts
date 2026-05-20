import { Inject, Injectable } from '@nestjs/common';
import {
    TELEGRAM_NOTIFICATION_PORT,
    TelegramNotificationPort,
} from '@components/telegram/core/application/ports/telegram-notification.port';
import { NotificationMessageFactory } from '@components/telegram/core/domain/models/messages/notifications/notification-message.factory';
import { USERS_API_PORT, UsersApiPort } from '@components/users/api/users-api.port';
import { logger } from '@/infra/logger/logger';
import { EventType } from '@domain/models/events/event-type';
import { NotifyUserParams } from './notify-user-params';

const CRITICAL_EVENT_TYPES = new Set<EventType>([EventType.GridStopLossTriggered]);

/** Routes a serializable event to the user's personal Telegram chat.
 * Skips silently when the user is not found or has tradeNotificationsEnabled: false.
 * Critical events (stop-loss) bypass the trade-notifications toggle. */
@Injectable()
export class NotifyUserUseCase {
    private readonly logger = logger.child({ context: NotifyUserUseCase.name });

    constructor(
        @Inject(TELEGRAM_NOTIFICATION_PORT)
        private readonly telegramNotification: TelegramNotificationPort,
        private readonly messageFactory: NotificationMessageFactory,
        @Inject(USERS_API_PORT) private readonly usersApi: UsersApiPort,
    ) {}

    async execute(params: NotifyUserParams): Promise<void> {
        const { event } = params;
        const user = await this.usersApi.findUserById(event.userId);
        if (!user) {
            this.logger.warn(
                { userId: event.userId, eventType: event.eventType },
                'User not found for notification event',
            );
            return;
        }
        const isCritical = CRITICAL_EVENT_TYPES.has(event.eventType);
        if (!isCritical && !user.tradeNotificationsEnabled) {
            this.logger.debug(
                { chatId: user.telegramChatId, eventType: event.eventType },
                'Trade notifications disabled — skipping',
            );
            return;
        }
        let text: string;
        try {
            text = this.messageFactory.buildFromEvent(event).text;
        } catch (err) {
            this.logger.warn(
                { eventType: event.eventType, userId: event.userId, err },
                'Failed to build notification message — skipping',
            );
            return;
        }
        await this.telegramNotification.sendMessage(user.telegramChatId, text);
    }
}
