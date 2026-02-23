import { Module } from '@nestjs/common';
import { AppConfigModule } from '@/config/app-config.module';
import { RedisModule } from '@adapters/outbound/cache/redis.module';
import { LoggerModule } from '@adapters/outbound/logger/logger.module';
import { TelegramModule } from '../../components/telegram/telegram.module';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '@adapters/outbound/database/database.module';
import { HttpModule } from '@/infra/http/http.module';
import { MetricsModule } from '@adapters/inbound/metrics/metrics.module';
import { HealthModule } from '@adapters/inbound/health/health.module';
import { EventBusModule } from '@adapters/outbound/events/event-bus.module';

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

        TelegramModule,
    ],
})
export class TelegramCtrlAppModule {}
