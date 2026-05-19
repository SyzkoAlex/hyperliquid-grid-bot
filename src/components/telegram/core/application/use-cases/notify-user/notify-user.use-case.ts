import { Inject, Injectable } from '@nestjs/common';
import {
    TELEGRAM_NOTIFICATION_PORT,
    TelegramNotificationPort,
} from '@components/telegram/core/application/ports/telegram-notification.port';
import { NotificationMessageFactory } from '@components/telegram/core/domain/models/messages/notifications/notification-message.factory';
import { NotificationRouterService } from '@components/telegram/core/application/services/notification-router/notification-router.service';
import { logger } from '@/infra/logger/logger';
import { NotifyUserParams } from './notify-user-params';

@Injectable()
export class NotifyUserUseCase {
    private readonly logger = logger.child({ context: NotifyUserUseCase.name });

    constructor(
        @Inject(TELEGRAM_NOTIFICATION_PORT)
        private readonly telegramNotification: TelegramNotificationPort,
        private readonly messageFactory: NotificationMessageFactory,
        private readonly router: NotificationRouterService,
    ) {}

    async execute(params: NotifyUserParams): Promise<void> {
        const { event } = params;
        const route = await this.router.resolve(event);
        if (!route) return;
        if (!route.tradeNotificationsEnabled) {
            this.logger.debug(
                { chatId: route.chatId, eventType: event.eventType },
                'Trade notifications disabled — skipping',
            );
            return;
        }
        const text = this.messageFactory.buildFromEvent(event).text;
        await this.telegramNotification.sendMessage(route.chatId, text);
    }
}
