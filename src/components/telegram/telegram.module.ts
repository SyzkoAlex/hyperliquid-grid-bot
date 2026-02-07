import { Module } from '@nestjs/common';
import { TelegramCommandsController } from './controllers/telegram-commands/telegram-commands.controller';
import { TradingEventsController } from './controllers/trading-events/trading-events.controller';
import { TelegramBotService } from './secondary/services/telegram-bot/telegram-bot.service';
import { RedisSessionStore } from './secondary/services/telegram-bot/redis-session-store';
import { NOTIFICATION_SERVICE } from './core/services/notification.service';
import { NotificationMessageFactory } from './core/services/notification-message.factory';
import { NotifyUserUseCase } from './core/use-cases/notify-user/notify-user.use-case';

@Module({
    providers: [
        RedisSessionStore,
        TelegramBotService,
        { provide: NOTIFICATION_SERVICE, useExisting: TelegramBotService },
        NotificationMessageFactory,
        NotifyUserUseCase,
        TelegramCommandsController,
        TradingEventsController,
    ],
    exports: [TelegramCommandsController],
})
export class TelegramModule {}
