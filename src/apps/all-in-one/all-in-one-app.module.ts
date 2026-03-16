import { Module } from '@nestjs/common';
import { AppConfigModule } from '@/config/app-config.module';
import { DatabaseModule } from '@/infra/database/database.module';
import { RedisCacheModule } from '@adapters/outbound/cache/redis-cache.module';
import { RedisDistributedLockModule } from '@adapters/outbound/distributed-lock/redis-distributed-lock.module';
import { HttpModule } from '@/infra/http/http.module';
import { MetricsModule } from '@adapters/inbound/metrics/metrics.module';
import { HealthModule } from '@adapters/inbound/health/health.module';
import { GridsModule } from '../../components/grids/grids.module';
import { TradingModule } from '../../components/trading/trading.module';
import { TelegramModule } from '../../components/telegram/telegram.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
    imports: [
        // Infrastructure
        ScheduleModule.forRoot(),
        AppConfigModule.forRoot(),
        DatabaseModule,
        RedisCacheModule,
        RedisDistributedLockModule,
        HttpModule,
        MetricsModule,
        HealthModule,

        // Components
        GridsModule,
        TradingModule,
        TelegramModule,
    ],
})
export class AllInOneAppModule {}
