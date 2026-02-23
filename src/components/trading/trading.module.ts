import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HyperliquidModule } from '@/infra/hyperliqued/hyperliquid.module';
import { Config } from '@/config/config.schema';
import { HyperliquidOrderClientAdapter } from '@components/trading/adapters/outbound/exchange/hyperliquid/hyperliquid-order-client.adapter';
import { HyperliquidInfoClientAdapter } from '@adapters/outbound/hyperliquid/hyperliquid-info-client.adapter';
import { HyperliquidOrderMapper } from '@components/trading/adapters/outbound/exchange/hyperliquid/hyperliquid-order.mapper';
import { HyperliquidInfoMapper } from '@adapters/outbound/hyperliquid/hyperliquid-info-mapper';
import { OrderEventsListener } from '@components/trading/adapters/outbound/exchange/hyperliquid/order-events.listener';
import { PostgresGridRepositoryAdapter } from '@components/trading/adapters/outbound/persistence/grid/postgres-grid-repository.adapter';
import { PostgresOrderRepositoryAdapter } from '@components/trading/adapters/outbound/persistence/order/postgres-order-repository.adapter';
import { GRID_REPOSITORY_PORT } from '@components/trading/core/application/ports/grid-repository.port';
import { ORDER_REPOSITORY_PORT } from '@components/trading/core/application/ports/order-repository.port';
import { EXCHANGE_CLIENT_PORT } from '@components/trading/core/application/ports/exchange-client.port';
import { EXCHANGE_INFO_PORT } from '@components/trading/core/application/ports/exchange-info.port';
import { CreateAndStartGridUseCase } from '@components/trading/core/application/use-cases/create-and-start-grid/create-and-start-grid.use-case';
import { SyncOrdersUseCase } from '@components/trading/core/application/use-cases/sync-orders/sync-orders.use-case';
import { ProcessOrderStatusUseCase } from '@components/trading/core/application/use-cases/process-order-status/process-order-status.use-case';
import { RestoreOrdersUseCase } from '@components/trading/core/application/use-cases/restore-orders/restore-orders.use-case';
import { CapitalCalculatorService } from '@domain/services/capital-calculator/capital-calculator.service';
import { GridLevelsCalculatorService } from '@components/trading/core/domain/services/grid-levels-calculator/grid-levels-calculator.service';
import { UserBalanceExtractorService } from '@domain/services/user-balance-extractor/user-balance-extractor.service';
import { OrderStatusSyncService } from '@components/trading/core/application/services/order-status-sync/order-status-sync.service';
import { OrderRefillService } from '@components/trading/core/application/services/order-refill/order-refill.service';
import { OrderRestoreService } from '@components/trading/core/application/services/order-restore/order-restore.service';
import { OrderPlacementService } from '@components/trading/core/application/services/order-placement/order-placement.service';
import { ProfitCalculatorService } from '@components/trading/core/domain/services/profit-calculator/profit-calculator.service';
import { GridCommandsController } from '@components/trading/adapters/inbound/grid-commands/grid-commands.controller';
import { CreateGridHandler } from '@components/trading/adapters/inbound/grid-commands/handlers/create-grid/create-grid.handler';
import { StopGridHandler } from '@components/trading/adapters/inbound/grid-commands/handlers/stop-grid/stop-grid.handler';
import { StopGridUseCase } from '@components/trading/core/application/use-cases/stop-grid/stop-grid.use-case';
import { OrdersPollingController } from '@components/trading/adapters/inbound/orders-polling/orders-polling.controller';
import { OrdersWebsocketController } from '@components/trading/adapters/inbound/orders-websocket/orders-websocket.controller';
import { OrdersRestoreController } from '@components/trading/adapters/inbound/orders-restore/orders-restore.controller';
import { HyperliquidWsClient } from '@adapters/inbound/hyperliqued/hyperliquid-ws.client';

@Module({
    imports: [HyperliquidModule],
    providers: [
        { provide: GRID_REPOSITORY_PORT, useClass: PostgresGridRepositoryAdapter },
        { provide: ORDER_REPOSITORY_PORT, useClass: PostgresOrderRepositoryAdapter },
        { provide: EXCHANGE_CLIENT_PORT, useClass: HyperliquidOrderClientAdapter },
        { provide: EXCHANGE_INFO_PORT, useClass: HyperliquidInfoClientAdapter },
        HyperliquidOrderMapper,
        HyperliquidInfoMapper,
        HyperliquidWsClient,
        OrderEventsListener,
        CreateAndStartGridUseCase,
        SyncOrdersUseCase,
        ProcessOrderStatusUseCase,
        RestoreOrdersUseCase,
        { provide: CapitalCalculatorService, useValue: new CapitalCalculatorService() },
        {
            provide: GridLevelsCalculatorService,
            useFactory: (configService: ConfigService<Config, true>) => {
                const { minOrderNotional } = configService.get('hyperliquid', { infer: true });
                return new GridLevelsCalculatorService(minOrderNotional);
            },
            inject: [ConfigService],
        },
        { provide: UserBalanceExtractorService, useValue: new UserBalanceExtractorService() },
        OrderStatusSyncService,
        OrderRefillService,
        OrderRestoreService,
        OrderPlacementService,
        { provide: ProfitCalculatorService, useValue: new ProfitCalculatorService() },
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
