import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Config } from '@/config/config.schema';
import {
    TELEGRAM_NOTIFICATION_PORT,
    TelegramNotificationPort,
} from '@components/telegram/core/application/ports/telegram-notification.port';
import { PendingCreationMessageStore } from '@components/telegram/core/application/services/pending-creation-message.store';
import { NotificationMessageFactory } from '@components/telegram/core/domain/models/messages/notification-message.factory';
import { NotifyUserParams } from './notify-user-params';
import { GridCreatedSuccessEvent } from '@domain/models/events/trading/grid-created-success.event';
import { GridCreatedErrorEvent } from '@domain/models/events/trading/grid-created-error.event';

@Injectable()
export class NotifyUserUseCase {
    private readonly notificationChatId: number;

    constructor(
        @Inject(TELEGRAM_NOTIFICATION_PORT)
        private readonly telegramNotification: TelegramNotificationPort,
        private readonly messageFactory: NotificationMessageFactory,
        private readonly pendingCreationMessageStore: PendingCreationMessageStore,
        configService: ConfigService<Config, true>,
    ) {
        this.notificationChatId = configService.get('telegram', { infer: true }).notificationChatId;
    }

    async execute(params: NotifyUserParams): Promise<void> {
        const { event } = params;

        // TODO check configService.get('telegram', { infer: true }).notifications for skip notification

        const message = this.messageFactory.buildFromEvent(event);
        const text = message.toString();

        if (this.isGridCreationResultEvent(event)) {
            const pending = this.pendingCreationMessageStore.consume();
            if (pending) {
                await this.telegramNotification.editMessage(
                    pending.chatId,
                    pending.messageId,
                    text,
                );
                return;
            }
        }

        await this.telegramNotification.sendMessage(this.notificationChatId, text);
    }

    private isGridCreationResultEvent(event: unknown): boolean {
        return event instanceof GridCreatedSuccessEvent || event instanceof GridCreatedErrorEvent;
    }
}
