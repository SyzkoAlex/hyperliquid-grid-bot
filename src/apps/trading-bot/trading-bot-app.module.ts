import { Module } from '@nestjs/common';
import { AppConfigModule } from '@/config/app-config.module';
import { LoggerModule } from '@adapters/outbound/logger/logger.module';
import { DatabaseModule } from '@adapters/outbound/database/database.module';
import { RedisModule } from '@adapters/outbound/cache/redis.module';
import { HttpModule } from '@/infra/http/http.module';
import { MetricsModule } from '@adapters/inbound/metrics/metrics.module';
import { HealthModule } from '@adapters/inbound/health/health.module';
import { EventBusModule } from '@adapters/outbound/events/event-bus.module';
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
