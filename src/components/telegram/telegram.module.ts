import { Module } from '@nestjs/common';
import { TelegramCommandsController } from './adapters/inbound/telegram-commands/telegram-commands.controller';
import { TradingEventsController } from './adapters/inbound/trading-events/trading-events.controller';
import { TelegramBotService } from './adapters/inbound/telegram-bot/telegram-bot.service';
import { RedisSessionStore } from './adapters/inbound/telegram-bot/redis-session-store';
import { StartHandler } from './adapters/inbound/telegram-bot/handlers/start/start.handler';
import { HelpHandler } from './adapters/inbound/telegram-bot/handlers/help/help.handler';
import { MainMenuHandler } from './adapters/inbound/telegram-bot/handlers/main-menu/main-menu.handler';
import { NotificationMessageFactory } from './core/domain/models/messages/notification-message.factory';
import { NotifyUserUseCase } from './core/application/use-cases/notify-user/notify-user.use-case';
import { HyperliquidModule } from '@/infra/hyperliqued/hyperliquid.module';
import { HyperliquidInfoClientAdapter } from '@adapters/outbound/hyperliquid/hyperliquid-info-client.adapter';
import { HyperliquidInfoMapper } from '@adapters/outbound/hyperliquid/hyperliquid-info-mapper';
import { PostgresGridRepositoryAdapter } from './adapters/outbound/persistence/grid/postgres-grid-repository.adapter';
import { PostgresOrderRepositoryAdapter } from './adapters/outbound/persistence/order/postgres-order-repository.adapter';
import { CreateGridSceneHandler } from './adapters/inbound/telegram-bot/scenes/create-grid/create-grid.scene';
import { SelectPairStep } from './adapters/inbound/telegram-bot/scenes/create-grid/steps/select-pair.step';
import { SelectModeStep } from './adapters/inbound/telegram-bot/scenes/create-grid/steps/select-mode.step';
import { QuickStartStep } from './adapters/inbound/telegram-bot/scenes/create-grid/steps/quick-start.step';
import { AdvancedUpperStep } from './adapters/inbound/telegram-bot/scenes/create-grid/steps/advanced-upper.step';
import { AdvancedLowerStep } from './adapters/inbound/telegram-bot/scenes/create-grid/steps/advanced-lower.step';
import { AdvancedLevelsStep } from './adapters/inbound/telegram-bot/scenes/create-grid/steps/advanced-levels.step';
import { AdvancedInvestmentStep } from './adapters/inbound/telegram-bot/scenes/create-grid/steps/advanced-investment.step';
import { AdvancedPreviewStep } from './adapters/inbound/telegram-bot/scenes/create-grid/steps/advanced-preview.step';
import { ConfirmStep } from './adapters/inbound/telegram-bot/scenes/create-grid/steps/confirm.step';
import { UserBalanceExtractorService } from '@domain/services/user-balance-extractor/user-balance-extractor.service';
import { CapitalCalculatorService } from '@domain/services/capital-calculator/capital-calculator.service';
import { WizardNavigator } from './adapters/inbound/telegram-bot/scenes/create-grid/wizard/wizard-navigator';
import { WizardMessageManager } from './adapters/inbound/telegram-bot/scenes/create-grid/wizard/wizard-message-manager';
import { GridsHandler } from './adapters/inbound/telegram-bot/handlers/grids/grids.handler';
import { GridViewHandler } from './adapters/inbound/telegram-bot/handlers/grid-view/grid-view.handler';
import { GetGridsWithPnlUseCase } from './core/application/use-cases/get-grids-with-pnl/get-grids-with-pnl.use-case';
import { GetGridWithPnlUseCase } from './core/application/use-cases/get-grid-with-pnl/get-grid-with-pnl.use-case';
import { CreateGridUseCase } from './core/application/use-cases/create-grid/create-grid.use-case';
import { StopGridUseCase } from './core/application/use-cases/stop-grid/stop-grid.use-case';
import { GridPnlCalculatorService } from '@domain/services/grid-pnl-calculator/grid-pnl-calculator.service';
import { EXCHANGE_INFO_PORT } from '@components/telegram/core/application/ports/exchange-info.port';
import { TELEGRAM_GRID_REPOSITORY_PORT } from '@components/telegram/core/application/ports/grid-repository.port';
import { TELEGRAM_ORDER_REPOSITORY_PORT } from '@components/telegram/core/application/ports/order-repository.port';
import { TELEGRAM_NOTIFICATION_PORT } from '@components/telegram/core/application/ports/telegram-notification.port';

@Module({
    imports: [HyperliquidModule],
    providers: [
        { provide: EXCHANGE_INFO_PORT, useClass: HyperliquidInfoClientAdapter },
        { provide: TELEGRAM_GRID_REPOSITORY_PORT, useClass: PostgresGridRepositoryAdapter },
        { provide: TELEGRAM_ORDER_REPOSITORY_PORT, useClass: PostgresOrderRepositoryAdapter },
        { provide: TELEGRAM_NOTIFICATION_PORT, useClass: TelegramBotService },
        HyperliquidInfoMapper,
        PostgresOrderRepositoryAdapter,
        RedisSessionStore,
        TelegramBotService,
        { provide: NotificationMessageFactory, useValue: new NotificationMessageFactory() },
        NotifyUserUseCase,
        StartHandler,
        HelpHandler,
        MainMenuHandler,
        TelegramCommandsController,
        TradingEventsController,
        { provide: UserBalanceExtractorService, useValue: new UserBalanceExtractorService() },
        { provide: CapitalCalculatorService, useValue: new CapitalCalculatorService() },
        WizardNavigator,
        WizardMessageManager,
        CreateGridSceneHandler,
        GetGridsWithPnlUseCase,
        GetGridWithPnlUseCase,
        CreateGridUseCase,
        StopGridUseCase,
        { provide: GridPnlCalculatorService, useValue: new GridPnlCalculatorService() },
        GridsHandler,
        GridViewHandler,
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
