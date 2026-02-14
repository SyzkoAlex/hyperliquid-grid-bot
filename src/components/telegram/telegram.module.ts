import { Module } from '@nestjs/common';
import { TelegramCommandsController } from './controllers/telegram-commands/telegram-commands.controller';
import { TradingEventsController } from './controllers/trading-events/trading-events.controller';
import { TelegramBotService } from './core/services/telegram-bot/telegram-bot.service';
import { RedisSessionStore } from './core/services/telegram-bot/redis-session-store';
import { StartHandler } from './core/services/telegram-bot/handlers/start/start.handler';
import { HelpHandler } from './core/services/telegram-bot/handlers/help/help.handler';
import { MainMenuHandler } from './core/services/telegram-bot/handlers/main-menu/main-menu.handler';
import { NotificationMessageFactory } from './core/domain/messages/notification-message.factory';
import { NotifyUserUseCase } from './core/use-cases/notify-user/notify-user.use-case';
import { HyperliquidModule } from '@infra/hyperliquid/hyperliquid.module';
import { HyperliquidInfoClient } from '@components/shared/secondary/clients/hyperliquid-info.client';
import { HyperliquidUserStateMapper } from '@components/shared/secondary/mappers/hyperliquid-user-state.mapper';
import { PostgresGridRepository } from './secondary/repository/grid/postgres-grid.repository';
import { PostgresOrderRepository } from './secondary/repository/order/postgres-order.repository';
import { CreateGridSceneHandler } from './core/services/telegram-bot/scenes/create-grid/create-grid.scene';
import { SelectPairStep } from './core/services/telegram-bot/scenes/create-grid/steps/select-pair.step';
import { SelectModeStep } from './core/services/telegram-bot/scenes/create-grid/steps/select-mode.step';
import { QuickStartStep } from './core/services/telegram-bot/scenes/create-grid/steps/quick-start.step';
import { AdvancedUpperStep } from './core/services/telegram-bot/scenes/create-grid/steps/advanced-upper.step';
import { AdvancedLowerStep } from './core/services/telegram-bot/scenes/create-grid/steps/advanced-lower.step';
import { AdvancedLevelsStep } from './core/services/telegram-bot/scenes/create-grid/steps/advanced-levels.step';
import { AdvancedInvestmentStep } from './core/services/telegram-bot/scenes/create-grid/steps/advanced-investment.step';
import { AdvancedPreviewStep } from './core/services/telegram-bot/scenes/create-grid/steps/advanced-preview.step';
import { ConfirmStep } from './core/services/telegram-bot/scenes/create-grid/steps/confirm.step';
import { UserBalanceExtractorService } from '@components/shared/core/services/user-balance-extractor/user-balance-extractor.service';
import { CapitalCalculatorService } from '@components/shared/core/services/capital-calculator/capital-calculator.service';
import { WizardNavigator } from './core/services/telegram-bot/scenes/create-grid/wizard/wizard-navigator';
import { WizardMessageManager } from './core/services/telegram-bot/scenes/create-grid/wizard/wizard-message-manager';

@Module({
    imports: [HyperliquidModule],
    providers: [
        RedisSessionStore,
        TelegramBotService,
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
        UserBalanceExtractorService,
        CapitalCalculatorService,
        WizardNavigator,
        WizardMessageManager,
        CreateGridSceneHandler,
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
