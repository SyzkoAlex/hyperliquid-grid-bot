import { Module } from '@nestjs/common';
import { AppConfigModule } from '@infra/config/app-config.module';
import { LoggerModule } from '../../infra/logger/logger.module';
import { TelegramModule } from '../../components/telegram/telegram.module';

/**
 * Telegram Control Application Module
 *
 * Standalone Telegram Bot for notifications and control interface.
 * Runs independently from trading bot.
 */
@Module({
    imports: [
        // Infrastructure
        AppConfigModule.forRoot(),
        LoggerModule,

        // Components
        TelegramModule,
    ],
})
export class TelegramCtrlAppModule {}
