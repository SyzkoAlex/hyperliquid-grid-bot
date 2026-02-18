import { Module } from '@nestjs/common';
import { TelegramCommandsController } from './infra/adapters/inbound/telegram-commands/telegram-commands.controller';
import { TradingEventsController } from './infra/adapters/inbound/trading-events/trading-events.controller';
import { TelegramBotService } from './infra/adapters/inbound/telegram-bot/telegram-bot.service';
import { RedisSessionStore } from './infra/adapters/inbound/telegram-bot/redis-session-store';
import { StartHandler } from './infra/adapters/inbound/telegram-bot/handlers/start/start.handler';
import { HelpHandler } from './infra/adapters/inbound/telegram-bot/handlers/help/help.handler';
import { MainMenuHandler } from './infra/adapters/inbound/telegram-bot/handlers/main-menu/main-menu.handler';
import { NotificationMessageFactory } from './domain/models/messages/notification-message.factory';
import { NotifyUserUseCase } from './application/use-cases/notify-user/notify-user.use-case';
import { HyperliquidModule } from '@infra/hyperliquid/hyperliquid.module';
import { HyperliquidInfoClientAdapter } from '@components/shared/infra/adapters/outbound/exchange/hyperliquid/hyperliquid-info-client.adapter';
import { HyperliquidUserStateMapper } from '@components/shared/infra/adapters/outbound/mappers/hyperliquid-user-state.mapper';
import { PostgresGridRepositoryAdapter } from './infra/adapters/outbound/persistence/grid/postgres-grid-repository.adapter';
import { PostgresOrderRepositoryAdapter } from './infra/adapters/outbound/persistence/order/postgres-order-repository.adapter';
import { CreateGridSceneHandler } from './infra/adapters/inbound/telegram-bot/scenes/create-grid/create-grid.scene';
import { SelectPairStep } from './infra/adapters/inbound/telegram-bot/scenes/create-grid/steps/select-pair.step';
import { SelectModeStep } from './infra/adapters/inbound/telegram-bot/scenes/create-grid/steps/select-mode.step';
import { QuickStartStep } from './infra/adapters/inbound/telegram-bot/scenes/create-grid/steps/quick-start.step';
import { AdvancedUpperStep } from './infra/adapters/inbound/telegram-bot/scenes/create-grid/steps/advanced-upper.step';
import { AdvancedLowerStep } from './infra/adapters/inbound/telegram-bot/scenes/create-grid/steps/advanced-lower.step';
import { AdvancedLevelsStep } from './infra/adapters/inbound/telegram-bot/scenes/create-grid/steps/advanced-levels.step';
import { AdvancedInvestmentStep } from './infra/adapters/inbound/telegram-bot/scenes/create-grid/steps/advanced-investment.step';
import { AdvancedPreviewStep } from './infra/adapters/inbound/telegram-bot/scenes/create-grid/steps/advanced-preview.step';
import { ConfirmStep } from './infra/adapters/inbound/telegram-bot/scenes/create-grid/steps/confirm.step';
import { UserBalanceExtractorService } from '@domain/services/user-balance-extractor/user-balance-extractor.service';
import { CapitalCalculatorService } from '@domain/services/capital-calculator/capital-calculator.service';
import { WizardNavigator } from './infra/adapters/inbound/telegram-bot/scenes/create-grid/wizard/wizard-navigator';
import { WizardMessageManager } from './infra/adapters/inbound/telegram-bot/scenes/create-grid/wizard/wizard-message-manager';
import { GridsHandler } from './infra/adapters/inbound/telegram-bot/handlers/grids/grids.handler';
import { GetGridsWithPnlUseCase } from './application/use-cases/get-grids-with-pnl/get-grids-with-pnl.use-case';
import { CreateGridUseCase } from './application/use-cases/create-grid/create-grid.use-case';
import { GridPnlCalculatorService } from '@domain/services/grid-pnl-calculator/grid-pnl-calculator.service';
import { INFO_CLIENT_PORT } from '@domain/ports/outbound/info-client.port';
import { TELEGRAM_GRID_REPOSITORY_PORT } from './domain/ports/outbound/grid-repository.port';
import { TELEGRAM_ORDER_REPOSITORY_PORT } from './domain/ports/outbound/order-repository.port';

@Module({
    imports: [HyperliquidModule],
    providers: [
        { provide: INFO_CLIENT_PORT, useClass: HyperliquidInfoClientAdapter },
        { provide: TELEGRAM_GRID_REPOSITORY_PORT, useClass: PostgresGridRepositoryAdapter },
        { provide: TELEGRAM_ORDER_REPOSITORY_PORT, useClass: PostgresOrderRepositoryAdapter },
        HyperliquidUserStateMapper,
        PostgresOrderRepositoryAdapter,
        RedisSessionStore,
        TelegramBotService,
        NotificationMessageFactory,
        NotifyUserUseCase,
        StartHandler,
        HelpHandler,
        MainMenuHandler,
        TelegramCommandsController,
        TradingEventsController,
        UserBalanceExtractorService,
        CapitalCalculatorService,
        WizardNavigator,
        WizardMessageManager,
        CreateGridSceneHandler,
        GetGridsWithPnlUseCase,
        CreateGridUseCase,
        GridPnlCalculatorService,
        GridsHandler,
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
