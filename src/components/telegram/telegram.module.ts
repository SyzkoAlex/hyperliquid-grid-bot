import { Module } from '@nestjs/common';
import { TelegramCommandsController } from './controllers/telegram-commands/telegram-commands.controller';
import { StartHandler } from './controllers/telegram-commands/handlers/start/start.handler';
import { HelpHandler } from './controllers/telegram-commands/handlers/help/help.handler';
import { MainMenuHandler } from './controllers/telegram-commands/handlers/main-menu/main-menu.handler';
import { TradingEventsController } from './controllers/trading-events/trading-events.controller';
import { TelegramBotService } from './secondary/services/telegram-bot/telegram-bot.service';
import { RedisSessionStore } from './secondary/services/telegram-bot/redis-session-store';
import { NOTIFICATION_SERVICE } from './core/services/notification.service';
import { COMMAND_REGISTRAR } from './core/services/command-registrar.service';
import { NotificationMessageFactory } from './core/services/notification-message.factory';
import { NotifyUserUseCase } from './core/use-cases/notify-user/notify-user.use-case';

@Module({
    providers: [
        RedisSessionStore,
        TelegramBotService,
        { provide: NOTIFICATION_SERVICE, useExisting: TelegramBotService },
        { provide: COMMAND_REGISTRAR, useExisting: TelegramBotService },
        NotificationMessageFactory,
        NotifyUserUseCase,
        StartHandler,
        HelpHandler,
        MainMenuHandler,
        TelegramCommandsController,
        TradingEventsController,
    ],
    exports: [TelegramCommandsController],
})
export class TelegramModule {}
