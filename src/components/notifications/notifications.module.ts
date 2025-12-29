import { Module } from '@nestjs/common';
import { TelegrafBotController } from './controllers/bot/telegram/telegraf-bot.controller';
import { TradingEventsConsumer } from './controllers/consumer/trading-events/trading-events.consumer';

/**
 * Notifications Module
 *
 * INDEPENDENT COMPONENT - no imports from other components!
 * - Subscribes to events via EventBus
 * - Sends notifications via Telegram
 *
 * Dependencies: ONLY EventBus (infrastructure)
 */
@Module({
    providers: [
        TelegrafBotController,
        TradingEventsConsumer, // Subscribes to events from trading component
    ],
    exports: [TelegrafBotController],
})
export class NotificationsModule {}
