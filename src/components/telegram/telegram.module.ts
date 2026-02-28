import { Module } from '@nestjs/common';
import { TelegramCommandsAdapter } from './adapters/inbound/telegram-commands/telegram-commands.adapter';
import { TradingEventsAdapter } from './adapters/inbound/trading-events/trading-events.adapter';
import { TelegramBotService } from './adapters/inbound/telegram-bot/telegram-bot.service';
import { RedisSessionStore } from './adapters/inbound/telegram-bot/redis-session-store';
import { StartHandler } from './adapters/inbound/telegram-bot/handlers/start/start.handler';
import { HelpHandler } from './adapters/inbound/telegram-bot/handlers/help/help.handler';
import { MainMenuHandler } from './adapters/inbound/telegram-bot/handlers/main-menu/main-menu.handler';
import { NotificationMessageFactory } from './core/domain/models/messages/notification-message.factory';
import { NotifyUserUseCase } from './core/application/use-cases/notify-user/notify-user.use-case';
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
import { WizardNavigator } from './adapters/inbound/telegram-bot/scenes/create-grid/wizard/wizard-navigator';
import { WizardMessageManager } from './adapters/inbound/telegram-bot/scenes/create-grid/wizard/wizard-message-manager';
import { GridsHandler } from './adapters/inbound/telegram-bot/handlers/grids/grids.handler';
import { GridViewHandler } from './adapters/inbound/telegram-bot/handlers/grid-view/grid-view.handler';
import { BalanceHandler } from './adapters/inbound/telegram-bot/handlers/balance/balance.handler';
import { GetGridsWithPnlUseCase } from './core/application/use-cases/get-grids-with-pnl/get-grids-with-pnl.use-case';
import { GetGridWithPnlUseCase } from './core/application/use-cases/get-grid-with-pnl/get-grid-with-pnl.use-case';
import { GetUserBalanceUseCase } from './core/application/use-cases/get-user-balance/get-user-balance.use-case';
import { CreateGridUseCase } from './core/application/use-cases/create-grid/create-grid.use-case';
import { StopGridUseCase } from './core/application/use-cases/stop-grid/stop-grid.use-case';
import { GridPnlCalculatorService } from './core/domain/services/grid-pnl-calculator/grid-pnl-calculator.service';
import { PendingCreationMessageStore } from './core/application/services/pending-creation-message.store';
import { TELEGRAM_NOTIFICATION_PORT } from '@components/telegram/core/application/ports/telegram-notification.port';
import { GridsModule } from '@components/grids/grids.module';
import { TradingModule } from '@components/trading/trading.module';
import { EventPublisherModule } from '@adapters/outbound/events/event-publisher.module';
import { EventSubscriberModule } from '@adapters/inbound/events/event-subscriber.module';
import { EventDeserializer } from '@domain/models/events/event-deserializer';

@Module({
    imports: [GridsModule, TradingModule, EventPublisherModule, EventSubscriberModule],
    providers: [
        TelegramBotService,
        { provide: TELEGRAM_NOTIFICATION_PORT, useExisting: TelegramBotService },
        RedisSessionStore,
        NotificationMessageFactory,
        PendingCreationMessageStore,
        NotifyUserUseCase,
        StartHandler,
        HelpHandler,
        MainMenuHandler,
        TelegramCommandsAdapter,
        TradingEventsAdapter,
        EventDeserializer,
        WizardNavigator,
        WizardMessageManager,
        CreateGridSceneHandler,
        GetGridsWithPnlUseCase,
        GetGridWithPnlUseCase,
        CreateGridUseCase,
        StopGridUseCase,
        GridPnlCalculatorService,
        GridsHandler,
        GridViewHandler,
        BalanceHandler,
        GetUserBalanceUseCase,
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
