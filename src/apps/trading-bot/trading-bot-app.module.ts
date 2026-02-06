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
import { ScheduleModule } from '@nestjs/schedule';

/**
 * Trading Bot Application Module
 *
 * Core trading bot application with automated grid trading.
 * Runs trading logic only (no telegram interface).
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

        // Trading Component
        TradingModule,
    ],
})
export class TradingBotAppModule {}
