import { Module } from '@nestjs/common';
import { AppConfigModule } from '@infra/config/app-config.module';
import { RedisModule } from '@infra/cache/redis.module';
import { LoggerModule } from '../../infra/logger/logger.module';
import { TelegramModule } from '../../components/telegram/telegram.module';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '@infra/database/database.module';
import { HttpModule } from '@infra/http/http.module';
import { MetricsModule } from '@infra/metrics/metrics.module';
import { HealthModule } from '@infra/health/health.module';
import { EventBusModule } from '@infra/events/event-bus.module';

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
