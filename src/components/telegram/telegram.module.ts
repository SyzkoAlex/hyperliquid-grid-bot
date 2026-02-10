import { Module } from '@nestjs/common';
import { TelegramCommandsController } from './controllers/telegram-commands/telegram-commands.controller';
import { StartHandler } from './controllers/telegram-commands/handlers/start/start.handler';
import { HelpHandler } from './controllers/telegram-commands/handlers/help/help.handler';
import { MainMenuHandler } from './controllers/telegram-commands/handlers/main-menu/main-menu.handler';
import { TradingEventsController } from './controllers/trading-events/trading-events.controller';
import { TelegramBotService } from './secondary/services/telegram-bot/telegram-bot.service';
import { RedisSessionStore } from './secondary/services/telegram-bot/redis-session-store';
import { NOTIFICATION_SERVICE } from './core/services/notification.service';
import { TELEGRAM_SERVICE } from './core/services/telegram.service';
import { NotificationMessageFactory } from './core/domain/messages/notification-message.factory';
import { NotifyUserUseCase } from './core/use-cases/notify-user/notify-user.use-case';
import { HyperliquidModule } from '@infra/hyperliquid/hyperliquid.module';
import { HyperliquidInfoClient } from '@components/shared/secondary/clients/hyperliquid-info.client';
import { HyperliquidUserStateMapper } from '@components/shared/secondary/mappers/hyperliquid-user-state.mapper';
import { PostgresGridRepository } from './secondary/repository/grid/postgres-grid.repository';
import { PostgresOrderRepository } from './secondary/repository/order/postgres-order.repository';
import { CreateGridSceneHandler } from './controllers/telegram-commands/scenes/create-grid/create-grid.scene';
import { TelegrafCreateGridSceneAdapter } from './secondary/services/telegram-bot/scenes/telegraf-create-grid-scene.adapter';
import { SelectPairStep } from './controllers/telegram-commands/scenes/create-grid/steps/select-pair.step';
import { SelectModeStep } from './controllers/telegram-commands/scenes/create-grid/steps/select-mode.step';
import { QuickStartStep } from './controllers/telegram-commands/scenes/create-grid/steps/quick-start.step';
import { AdvancedUpperStep } from './controllers/telegram-commands/scenes/create-grid/steps/advanced-upper.step';
import { AdvancedLowerStep } from './controllers/telegram-commands/scenes/create-grid/steps/advanced-lower.step';
import { AdvancedLevelsStep } from './controllers/telegram-commands/scenes/create-grid/steps/advanced-levels.step';
import { AdvancedInvestmentStep } from './controllers/telegram-commands/scenes/create-grid/steps/advanced-investment.step';
import { AdvancedPreviewStep } from './controllers/telegram-commands/scenes/create-grid/steps/advanced-preview.step';
import { ConfirmStep } from './controllers/telegram-commands/scenes/create-grid/steps/confirm.step';

@Module({
    imports: [HyperliquidModule],
    providers: [
        RedisSessionStore,
        TelegramBotService,
        { provide: NOTIFICATION_SERVICE, useExisting: TelegramBotService },
        { provide: TELEGRAM_SERVICE, useExisting: TelegramBotService },
        NotificationMessageFactory,
        NotifyUserUseCase,
        StartHandler,
        HelpHandler,
        MainMenuHandler,
        TelegramCommandsController,
        TradingEventsController,
        HyperliquidInfoClient,
        HyperliquidUserStateMapper,
        PostgresGridRepository,
        PostgresOrderRepository,
        CreateGridSceneHandler,
        TelegrafCreateGridSceneAdapter,
        SelectPairStep,
        SelectModeStep,
        QuickStartStep,
        AdvancedUpperStep,
        AdvancedLowerStep,
        AdvancedLevelsStep,
        AdvancedInvestmentStep,
        AdvancedPreviewStep,
        ConfirmStep,
    ],
})
export class TelegramModule {}
