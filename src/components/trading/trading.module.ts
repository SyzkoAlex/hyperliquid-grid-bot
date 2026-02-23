import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HyperliquidModule } from '@/infra/hyperliqued/hyperliquid.module';
import { Config } from '@/config/config.schema';
import { HyperliquidOrderClientAdapter } from '@components/trading/adapters/outbound/exchange/hyperliquid/hyperliquid-order-client.adapter';
import { HyperliquidInfoClientAdapter } from '@adapters/outbound/hyperliquid/hyperliquid-info-client.adapter';
import { HyperliquidOrderMapper } from '@components/trading/adapters/outbound/exchange/hyperliquid/hyperliquid-order.mapper';
import { HyperliquidInfoMapper } from '@adapters/outbound/hyperliquid/hyperliquid-info-mapper';
import { OrderEventsListener } from '@components/trading/adapters/outbound/exchange/hyperliquid/order-events.listener';
import { EXCHANGE_CLIENT_PORT } from '@components/trading/core/application/ports/exchange-client.port';
import { EXCHANGE_INFO_PORT } from '@components/trading/core/application/ports/exchange-info.port';
import { TRADING_QUERY_PORT } from '@components/trading/core/application/ports/trading-query.port';
import { TradingQueryAdapter } from '@components/trading/adapters/outbound/exchange/trading-query.adapter';
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
import { GridsModule } from '@components/grids/grids.module';

@Module({
    imports: [HyperliquidModule, GridsModule],
    providers: [
        { provide: EXCHANGE_CLIENT_PORT, useClass: HyperliquidOrderClientAdapter },
        { provide: EXCHANGE_INFO_PORT, useClass: HyperliquidInfoClientAdapter },
        { provide: TRADING_QUERY_PORT, useClass: TradingQueryAdapter },
        HyperliquidOrderMapper,
        HyperliquidInfoMapper,
        HyperliquidWsClient,
        OrderEventsListener,
        CreateAndStartGridUseCase,
        SyncOrdersUseCase,
        ProcessOrderStatusUseCase,
        RestoreOrdersUseCase,
        CapitalCalculatorService,
        {
            provide: GridLevelsCalculatorService,
            useFactory: (configService: ConfigService<Config, true>) => {
                const { minOrderNotional } = configService.get('hyperliquid', { infer: true });
                return new GridLevelsCalculatorService(minOrderNotional);
            },
            inject: [ConfigService],
        },
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
    exports: [TRADING_QUERY_PORT],
})
export class TradingModule {}
