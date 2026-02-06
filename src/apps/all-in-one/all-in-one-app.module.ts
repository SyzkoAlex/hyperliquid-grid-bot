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
import { TelegramModule } from '../../components/telegram/telegram.module';
import { ScheduleModule } from '@nestjs/schedule';

/**
 * All-In-One Application Module
 *
 * Runs both Trading Bot and Telegram Control in a single Node.js process.
 * Required for in-memory EventBus to enable communication between components.
 *
 * Component Architecture:
 * - Components are INDEPENDENT (no cross-component imports)
 * - Communication via EventBus (in-memory, single process)
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

        // Components
        TradingModule,
        TelegramModule,
    ],
})
export class AllInOneAppModule {}
