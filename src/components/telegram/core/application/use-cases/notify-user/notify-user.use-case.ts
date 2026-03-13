import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Config } from '@/config/config.schema';
import {
    TELEGRAM_NOTIFICATION_PORT,
    TelegramNotificationPort,
} from '@components/telegram/core/application/ports/telegram-notification.port';
import { NotificationMessageFactory } from '@components/telegram/core/domain/models/messages/notifications/notification-message.factory';
import { NotifyUserParams } from './notify-user-params';

@Injectable()
export class NotifyUserUseCase {
    private readonly notificationChatId: number;

    constructor(
        @Inject(TELEGRAM_NOTIFICATION_PORT)
        private readonly telegramNotification: TelegramNotificationPort,
        private readonly messageFactory: NotificationMessageFactory,
        configService: ConfigService<Config, true>,
    ) {
        this.notificationChatId = configService.get('telegram', { infer: true }).notificationChatId;
    }

    async execute(params: NotifyUserParams): Promise<void> {
        const { event } = params;

        // TODO check configService.get('telegram', { infer: true }).notifications for skip notification

        const text = this.messageFactory.buildFromEvent(event).text;
        await this.telegramNotification.sendMessage(this.notificationChatId, text);
    }
}
