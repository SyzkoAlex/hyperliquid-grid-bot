import { Module } from '@nestjs/common';
import { AppConfigModule } from '@infra/config/app-config.module';
import { RedisModule } from '@infra/cache/redis.module';
import { LoggerModule } from '../../infra/logger/logger.module';
import { TelegramModule } from '../../components/telegram/telegram.module';

@Module({
    imports: [AppConfigModule.forRoot(), LoggerModule, RedisModule, TelegramModule],
})
export class TelegramCtrlAppModule {}
