import { Module } from '@nestjs/common';
import { AppConfigModule } from '@infra/config/app-config.module';
import { LoggerModule } from '../../infra/logger/logger.module';
import { DatabaseModule } from '../../infra/database/database.module';
import { RedisModule } from '../../infra/cache/redis.module';
import { HttpModule } from '../../infra/http/http.module';
import { MetricsModule } from '../../infra/metrics/metrics.module';
import { HealthModule } from '../../infra/health/health.module';
import { EventBusModule } from '../../infra/events/event-bus.module';
import { TradingModule } from '../../components/trading/trading.module';
import { NotificationsModule } from '../../components/notifications/notifications.module';
import { ScheduleModule } from '@nestjs/schedule';

/**
 * Bot Application Module
 *
 * Main application for Grid Trading Bot.
 * Control via Telegram Bot only (no REST API).
 *
 * Component Architecture:
 * - Components are INDEPENDENT (no cross-component imports)
 * - Communication via EventBus
 */
@Module({
    imports: [
        // Infrastructure
        ScheduleModule.forRoot(),
        AppConfigModule.forRoot(),
        LoggerModule,
        DatabaseModule,
        RedisModule,
        HttpModule,
        MetricsModule,
        HealthModule,
        EventBusModule,

        // Independent Components
        TradingModule,
        NotificationsModule,
    ],
})
export class BotAppModule {}
