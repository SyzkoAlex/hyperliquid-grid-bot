import { Module } from '@nestjs/common';
import { TelegramCommandsAdapter } from './adapters/inbound/telegram-commands/telegram-commands.adapter';
import { TradingEventsAdapter } from './adapters/inbound/trading-events/trading-events.adapter';
import { TelegramBotService } from './adapters/inbound/telegram-bot/telegram-bot.service';
import { CacheSessionStore } from './adapters/inbound/telegram-bot/cache-session-store';
import { StartHandler } from './adapters/inbound/telegram-bot/handlers/start/start.handler';
import { HelpHandler } from './adapters/inbound/telegram-bot/handlers/help/help.handler';
import { NotificationMessageFactory } from './core/domain/models/messages/notifications/notification-message.factory';
import { NotifyUserUseCase } from './core/application/use-cases/notify-user/notify-user.use-case';
import { CreateGridSceneHandler } from './adapters/inbound/telegram-bot/scenes/create-grid/create-grid.scene';
import { ConnectAccountSceneHandler } from './adapters/inbound/telegram-bot/scenes/connect-account/connect-account.scene';
import { SelectPairStep } from './adapters/inbound/telegram-bot/scenes/create-grid/steps/select-pair.step';
import { SelectModeStep } from './adapters/inbound/telegram-bot/scenes/create-grid/steps/select-mode.step';
import { QuickStartStep } from './adapters/inbound/telegram-bot/scenes/create-grid/steps/quick-start.step';
import { AdvancedUpperStep } from './adapters/inbound/telegram-bot/scenes/create-grid/steps/advanced-upper.step';
import { AdvancedLowerStep } from './adapters/inbound/telegram-bot/scenes/create-grid/steps/advanced-lower.step';
import { AdvancedLevelsStep } from './adapters/inbound/telegram-bot/scenes/create-grid/steps/advanced-levels.step';
import { AdvancedInvestmentStep } from './adapters/inbound/telegram-bot/scenes/create-grid/steps/advanced-investment.step';
import { AdvancedStopLossStep } from './adapters/inbound/telegram-bot/scenes/create-grid/steps/advanced-stop-loss.step';
import { AdvancedPreviewStep } from './adapters/inbound/telegram-bot/scenes/create-grid/steps/advanced-preview.step';
import { ConfirmStep } from './adapters/inbound/telegram-bot/scenes/create-grid/steps/confirm.step';
import { EnterAddressStep } from './adapters/inbound/telegram-bot/scenes/connect-account/steps/enter-address.step';
import { ApproveAgentStep } from './adapters/inbound/telegram-bot/scenes/connect-account/steps/approve-agent.step';
import { VerifyApprovalStep } from './adapters/inbound/telegram-bot/scenes/connect-account/steps/verify-approval.step';
import { WizardNavigator } from './adapters/inbound/telegram-bot/scenes/create-grid/wizard/wizard-navigator';
import { WizardMessageManager } from './adapters/inbound/telegram-bot/scenes/create-grid/wizard/wizard-message-manager';
import { GridsHandler } from './adapters/inbound/telegram-bot/handlers/grids/grids.handler';
import { GridProfitTabHandler } from './adapters/inbound/telegram-bot/handlers/grid-view/grid-profit-tab.handler';
import { GridOrdersTabHandler } from './adapters/inbound/telegram-bot/handlers/grid-view/grid-orders-tab.handler';
import { GridHistoryTabHandler } from './adapters/inbound/telegram-bot/handlers/grid-view/grid-history-tab.handler';
import { StopGridHandler } from './adapters/inbound/telegram-bot/handlers/grid-view/stop-grid.handler';
import { BalanceHandler } from './adapters/inbound/telegram-bot/handlers/balance/balance.handler';
import { ConnectAccountHandler } from './adapters/inbound/telegram-bot/handlers/connect-account/connect-account.handler';
import { SettingsHandler } from './adapters/inbound/telegram-bot/handlers/settings/settings.handler';
import { GetGridsWithPnlUseCase } from './core/application/use-cases/get-grids-with-pnl/get-grids-with-pnl.use-case';
import { GetGridWithPnlUseCase } from './core/application/use-cases/get-grid-with-pnl/get-grid-with-pnl.use-case';
import { GetUserBalanceUseCase } from './core/application/use-cases/get-user-balance/get-user-balance.use-case';
import { CreateGridUseCase } from './core/application/use-cases/create-grid/create-grid.use-case';
import { StopGridUseCase } from './core/application/use-cases/stop-grid/stop-grid.use-case';
import { ConnectAccountUseCase } from './core/application/use-cases/connect-account/connect-account.use-case';
import { VerifyAgentUseCase } from './core/application/use-cases/verify-agent/verify-agent.use-case';
import { GridPnlCalculatorService } from './core/domain/services/grid-pnl-calculator/grid-pnl-calculator.service';
import { ManagedLockService } from '@/core/application/services/managed-lock/managed-lock.service';
import { GridSnapshotFactory } from './core/application/services/grid-snapshot-factory/grid-snapshot.factory';
import { ActiveGridsViewBuilder } from './core/application/services/active-grids-view-builder/active-grids-view-builder.service';
import { NotificationRouterService } from './core/application/services/notification-router/notification-router.service';
import { PendingCreationMessageStore } from './adapters/inbound/telegram-bot/pending-creation-message.store';
import { TELEGRAM_NOTIFICATION_PORT } from '@components/telegram/core/application/ports/telegram-notification.port';
import { GridsModule } from '@components/grids/grids.module';
import { TradingModule } from '@components/trading/trading.module';
import { UsersModule } from '@components/users/users.module';
import { EventPublisherModule } from '@adapters/outbound/events/event-publisher.module';
import { EventSubscriberModule } from '@adapters/inbound/events/event-subscriber.module';
import { EventDeserializer } from '@domain/models/events/event-deserializer';

@Module({
    imports: [GridsModule, TradingModule, UsersModule, EventPublisherModule, EventSubscriberModule],
    providers: [
        TelegramBotService,
        ManagedLockService,
        { provide: TELEGRAM_NOTIFICATION_PORT, useExisting: TelegramBotService },
        CacheSessionStore,
        NotificationMessageFactory,
        PendingCreationMessageStore,
        NotifyUserUseCase,
        StartHandler,
        HelpHandler,
        TelegramCommandsAdapter,
        TradingEventsAdapter,
        EventDeserializer,
        WizardNavigator,
        WizardMessageManager,
        CreateGridSceneHandler,
        ConnectAccountSceneHandler,
        GetGridsWithPnlUseCase,
        GetGridWithPnlUseCase,
        CreateGridUseCase,
        StopGridUseCase,
        ConnectAccountUseCase,
        VerifyAgentUseCase,
        GridPnlCalculatorService,
        GridSnapshotFactory,
        ActiveGridsViewBuilder,
        NotificationRouterService,
        GridsHandler,
        GridProfitTabHandler,
        GridOrdersTabHandler,
        GridHistoryTabHandler,
        StopGridHandler,
        BalanceHandler,
        ConnectAccountHandler,
        SettingsHandler,
        GetUserBalanceUseCase,
        SelectPairStep,
        SelectModeStep,
        QuickStartStep,
        AdvancedUpperStep,
        AdvancedLowerStep,
        AdvancedLevelsStep,
        AdvancedInvestmentStep,
        AdvancedStopLossStep,
        AdvancedPreviewStep,
        ConfirmStep,
        EnterAddressStep,
        ApproveAgentStep,
        VerifyApprovalStep,
    ],
})
export class TelegramModule {}
