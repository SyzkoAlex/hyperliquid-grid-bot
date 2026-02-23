import { Module } from '@nestjs/common';
import { AppConfigModule } from '@/config/app-config.module';
import { LoggerModule } from '@adapters/outbound/logger/logger.module';
import { DatabaseModule } from '@adapters/outbound/database/database.module';
import { RedisModule } from '@adapters/outbound/cache/redis.module';
import { HttpModule } from '@/infra/http/http.module';
import { MetricsModule } from '@adapters/inbound/metrics/metrics.module';
import { HealthModule } from '@adapters/inbound/health/health.module';
import { EventBusModule } from '@adapters/outbound/events/event-bus.module';
import { GridsModule } from '../../components/grids/grids.module';
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
        GridsModule,
        TradingModule,
        TelegramModule,
    ],
})
export class AllInOneAppModule {}
