import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Config } from '@infra/config/config.schema';
import { NOTIFICATION_SERVICE, NotificationService } from '../../services/notification.service';
import { NotificationMessageFactory } from '../../domain/messages/notification-message.factory';
import { NotifyUserParams } from './notify-user-params';

@Injectable()
export class NotifyUserUseCase {
    private readonly notificationChatId: number;

    constructor(
        @Inject(NOTIFICATION_SERVICE) private readonly notificationService: NotificationService,
        private readonly messageFactory: NotificationMessageFactory,
        configService: ConfigService<Config, true>,
    ) {
        this.notificationChatId = configService.get('telegram', { infer: true }).notificationChatId;
    }

    async execute(params: NotifyUserParams): Promise<void> {
        const { event } = params;

        // TODO check configService.get('telegram', { infer: true }).notifications for skip notification

        const message = this.messageFactory.buildFromEvent(event);
        await this.notificationService.sendMessage(this.notificationChatId, message.toString());
    }
}
