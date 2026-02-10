import { Module } from '@nestjs/common';
import { HyperliquidModule } from '@infra/hyperliquid/hyperliquid.module';
import { HyperliquidOrderClient } from '@components/trading/secondary/client/hyperliquid/hyperliquid-order.client';
import { HyperliquidInfoClient } from '@components/shared/secondary/clients/hyperliquid-info.client';
import { HyperliquidOrderMapper } from '@components/trading/secondary/client/hyperliquid/hyperliquid-order.mapper';
import { HyperliquidUserStateMapper } from '@components/shared/secondary/mappers/hyperliquid-user-state.mapper';
import { OrderEventsListener } from '@components/trading/secondary/client/hyperliquid/order-events.listener';
import { PostgresGridRepository } from '@components/trading/secondary/repository/grid/postgres-grid.repository';
import { PostgresOrderRepository } from '@components/trading/secondary/repository/order/postgres-order.repository';
import { CreateAndStartGridUseCase } from '@components/trading/core/use-cases/create-and-start-grid/create-and-start-grid.use-case';
import { SyncOrdersUseCase } from '@components/trading/core/use-cases/sync-orders/sync-orders.use-case';
import { ProcessOrderStatusUseCase } from '@components/trading/core/use-cases/process-order-status/process-order-status.use-case';
import { RestoreOrdersUseCase } from '@components/trading/core/use-cases/restore-orders/restore-orders.use-case';
import { CapitalCalculatorService } from '@components/trading/core/services/capital-calculator/capital-calculator.service';
import { GridLevelsCalculatorService } from '@components/trading/core/services/grid-levels-calculator/grid-levels-calculator.service';
import { UserBalanceExtractorService } from '@components/trading/core/services/user-balance-extractor/user-balance-extractor.service';
import { OrderStatusSyncService } from '@components/trading/core/services/order-status-sync/order-status-sync.service';
import { OrderRefillService } from '@components/trading/core/services/order-refill/order-refill.service';
import { OrderRestoreService } from '@components/trading/core/services/order-restore/order-restore.service';
import { OrderPlacementService } from '@components/trading/core/services/order-placement/order-placement.service';
import { ProfitCalculatorService } from '@components/trading/core/services/profit-calculator/profit-calculator.service';
import { GridCommandsController } from '@components/trading/controllers/grid-commands/grid-commands.controller';
import { CreateGridHandler } from '@components/trading/controllers/grid-commands/handlers/create-grid/create-grid.handler';
import { OrdersPollingController } from '@components/trading/controllers/orders-polling/orders-polling.controller';
import { OrdersWebsocketController } from '@components/trading/controllers/orders-websocket/orders-websocket.controller';
import { OrdersRestoreController } from '@components/trading/controllers/orders-restore/orders-restore.controller';

@Module({
    imports: [HyperliquidModule],
    providers: [
        HyperliquidOrderClient,
        HyperliquidInfoClient,
        HyperliquidOrderMapper,
        HyperliquidUserStateMapper,
        OrderEventsListener,
        PostgresGridRepository,
        PostgresOrderRepository,
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
        OrdersPollingController,
        OrdersWebsocketController,
        OrdersRestoreController,
    ],
})
export class TradingModule {}
