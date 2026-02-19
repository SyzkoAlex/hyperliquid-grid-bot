import { Module } from '@nestjs/common';
import { HyperliquidModule } from '@infra/hyperliquid/hyperliquid.module';
import { HyperliquidOrderClientAdapter } from '@components/trading/infra/adapters/outbound/exchange/hyperliquid/hyperliquid-order-client.adapter';
import { HyperliquidInfoClientAdapter } from '@components/shared/infra/adapters/outbound/exchange/hyperliquid/hyperliquid-info-client.adapter';
import { HyperliquidOrderMapper } from '@components/trading/infra/adapters/outbound/exchange/hyperliquid/hyperliquid-order.mapper';
import { HyperliquidUserStateMapper } from '@components/shared/infra/adapters/outbound/mappers/hyperliquid-user-state.mapper';
import { OrderEventsListener } from '@components/trading/infra/adapters/outbound/exchange/hyperliquid/order-events.listener';
import { PostgresGridRepositoryAdapter } from '@components/trading/infra/adapters/outbound/persistence/grid/postgres-grid-repository.adapter';
import { PostgresOrderRepositoryAdapter } from '@components/trading/infra/adapters/outbound/persistence/order/postgres-order-repository.adapter';
import { GRID_REPOSITORY_PORT } from '@components/trading/domain/ports/outbound/grid-repository.port';
import { ORDER_REPOSITORY_PORT } from '@components/trading/domain/ports/outbound/order-repository.port';
import { ORDER_CLIENT_PORT } from '@components/trading/domain/ports/outbound/order-client.port';
import { INFO_CLIENT_PORT } from '@domain/ports/outbound/info-client.port';
import { CreateAndStartGridUseCase } from '@components/trading/application/use-cases/create-and-start-grid/create-and-start-grid.use-case';
import { SyncOrdersUseCase } from '@components/trading/application/use-cases/sync-orders/sync-orders.use-case';
import { ProcessOrderStatusUseCase } from '@components/trading/application/use-cases/process-order-status/process-order-status.use-case';
import { RestoreOrdersUseCase } from '@components/trading/application/use-cases/restore-orders/restore-orders.use-case';
import { CapitalCalculatorService } from '@domain/services/capital-calculator/capital-calculator.service';
import { GridLevelsCalculatorService } from '@components/trading/domain/services/grid-levels-calculator/grid-levels-calculator.service';
import { UserBalanceExtractorService } from '@domain/services/user-balance-extractor/user-balance-extractor.service';
import { OrderStatusSyncService } from '@components/trading/domain/services/order-status-sync/order-status-sync.service';
import { OrderRefillService } from '@components/trading/domain/services/order-refill/order-refill.service';
import { OrderRestoreService } from '@components/trading/domain/services/order-restore/order-restore.service';
import { OrderPlacementService } from '@components/trading/domain/services/order-placement/order-placement.service';
import { ProfitCalculatorService } from '@components/trading/domain/services/profit-calculator/profit-calculator.service';
import { GridCommandsController } from '@components/trading/infra/adapters/inbound/grid-commands/grid-commands.controller';
import { CreateGridHandler } from '@components/trading/infra/adapters/inbound/grid-commands/handlers/create-grid/create-grid.handler';
import { StopGridHandler } from '@components/trading/infra/adapters/inbound/grid-commands/handlers/stop-grid/stop-grid.handler';
import { StopGridUseCase } from '@components/trading/application/use-cases/stop-grid/stop-grid.use-case';
import { OrdersPollingController } from '@components/trading/infra/adapters/inbound/orders-polling/orders-polling.controller';
import { OrdersWebsocketController } from '@components/trading/infra/adapters/inbound/orders-websocket/orders-websocket.controller';
import { OrdersRestoreController } from '@components/trading/infra/adapters/inbound/orders-restore/orders-restore.controller';

@Module({
    imports: [HyperliquidModule],
    providers: [
        { provide: GRID_REPOSITORY_PORT, useClass: PostgresGridRepositoryAdapter },
        { provide: ORDER_REPOSITORY_PORT, useClass: PostgresOrderRepositoryAdapter },
        { provide: ORDER_CLIENT_PORT, useClass: HyperliquidOrderClientAdapter },
        { provide: INFO_CLIENT_PORT, useClass: HyperliquidInfoClientAdapter },
        HyperliquidOrderMapper,
        HyperliquidUserStateMapper,
        OrderEventsListener,
        CreateAndStartGridUseCase,
        SyncOrdersUseCase,
        ProcessOrderStatusUseCase,
        RestoreOrdersUseCase,
        CapitalCalculatorService,
        GridLevelsCalculatorService,
        UserBalanceExtractorService,
        OrderStatusSyncService,
        OrderRefillService,
        OrderRestoreService,
        OrderPlacementService,
        ProfitCalculatorService,
        GridCommandsController,
        CreateGridHandler,
        StopGridHandler,
        StopGridUseCase,
        OrdersPollingController,
        OrdersWebsocketController,
        OrdersRestoreController,
    ],
})
export class TradingModule {}
