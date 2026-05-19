import { Inject, Injectable } from '@nestjs/common';
import {
    TELEGRAM_NOTIFICATION_PORT,
    TelegramNotificationPort,
} from '@components/telegram/core/application/ports/telegram-notification.port';
import { NotificationMessageFactory } from '@components/telegram/core/domain/models/messages/notifications/notification-message.factory';
import { USERS_API_PORT, UsersApiPort } from '@components/users/api/users-api.port';
import { logger } from '@/infra/logger/logger';
import { NotifyUserParams } from './notify-user-params';

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
        if (!user.tradeNotificationsEnabled) {
            this.logger.debug(
                { chatId: user.telegramChatId, eventType: event.eventType },
                'Trade notifications disabled — skipping',
            );
            return;
        }
        const text = this.messageFactory.buildFromEvent(event).text;
        await this.telegramNotification.sendMessage(user.telegramChatId, text);
    }
}
