import { Module } from '@nestjs/common';
import { TelegramCommandsController } from './controllers/telegram-commands/telegram-commands.controller';
import { TradingEventsController } from './controllers/trading-events/trading-events.controller';
import { TelegramBotService } from './secondary/services/telegram-bot/telegram-bot.service';
import { NotificationMessageFactory } from './core/services/notification-message.factory';
import { NotifyUserUseCase } from './core/use-cases/notify-user/notify-user.use-case';

/**
 * Telegram Module
 *
 * INDEPENDENT COMPONENT - no imports from other components!
 * - Subscribes to events via EventBus
 * - Sends notifications via Telegram
 *
 * Dependencies: ONLY EventBus (infrastructure)
 */
@Module({
    providers: [
        // Secondary adapters
        TelegramBotService,
        // Factories
        NotificationMessageFactory,
        // Use cases
        NotifyUserUseCase,
        // Controllers
        TelegramCommandsController,
        TradingEventsController,
    ],
    exports: [TelegramCommandsController],
})
export class TelegramModule {}
