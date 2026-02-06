import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Config } from '@infra/config/config.schema';
import { TelegramBotService } from '../../../secondary/services/telegram-bot/telegram-bot.service';
import { NotificationMessageFactory } from '../../services/notification-message.factory';
import { NotifyUserParams } from './notify-user-params';

@Injectable()
export class NotifyUserUseCase {
    private readonly notificationChatId: number;

    constructor(
        private readonly telegramBot: TelegramBotService,
        private readonly messageFactory: NotificationMessageFactory,
        configService: ConfigService<Config, true>,
    ) {
        this.notificationChatId = configService.get('telegram', { infer: true }).notificationChatId;
    }

    async execute(params: NotifyUserParams): Promise<void> {
        const { event } = params;

        const message = this.messageFactory.buildFromEvent(event);

        if (this.notificationChatId) {
            await this.telegramBot.sendMessage(this.notificationChatId, message.toString());
        }
    }
}
