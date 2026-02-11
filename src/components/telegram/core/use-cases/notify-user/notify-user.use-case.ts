import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Config } from '@infra/config/config.schema';
import { TelegramBotService } from '../../services/telegram-bot/telegram-bot.service';
import { NotificationMessageFactory } from '../../domain/messages/notification-message.factory';
import { NotifyUserParams } from './notify-user-params';

@Injectable()
export class NotifyUserUseCase {
    private readonly notificationChatId: number;

    constructor(
        private readonly telegramBotService: TelegramBotService,
        private readonly messageFactory: NotificationMessageFactory,
        configService: ConfigService<Config, true>,
    ) {
        this.notificationChatId = configService.get('telegram', { infer: true }).notificationChatId;
    }

    async execute(params: NotifyUserParams): Promise<void> {
        const { event } = params;

        // TODO check configService.get('telegram', { infer: true }).notifications for skip notification

        const message = this.messageFactory.buildFromEvent(event);
        await this.telegramBotService.sendMessage(this.notificationChatId, message.toString());
    }
}
