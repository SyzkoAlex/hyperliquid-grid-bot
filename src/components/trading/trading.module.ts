import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HyperliquidModule } from './adapters/outbound/exchange/hyperliquid/hyperliquid.module';
import { Config } from '@/config/config.schema';
import { CreateAndStartGridUseCase } from '@components/trading/core/application/use-cases/create-and-start-grid/create-and-start-grid.use-case';
import { SyncOrdersUseCase } from '@components/trading/core/application/use-cases/sync-orders/sync-orders.use-case';
import { ProcessOrderStatusUseCase } from '@components/trading/core/application/use-cases/process-order-status/process-order-status.use-case';
import { RestoreOrdersUseCase } from '@components/trading/core/application/use-cases/restore-orders/restore-orders.use-case';
import { CapitalCalculatorService } from '@components/trading/core/domain/services/capital-calculator/capital-calculator.service';
import { GridLevelsCalculatorService } from '@components/trading/core/domain/services/grid-levels-calculator/grid-levels-calculator.service';
import { UserBalanceExtractorService } from '@components/trading/core/domain/services/user-balance-extractor/user-balance-extractor.service';
import { OrderStatusSyncService } from '@components/trading/core/application/services/order-status-sync/order-status-sync.service';
import { OrderRefillService } from '@components/trading/core/application/services/order-refill/order-refill.service';
import { OrderRestoreService } from '@components/trading/core/application/services/order-restore/order-restore.service';
import { OrderPlacementService } from '@components/trading/core/application/services/order-placement/order-placement.service';
import { ProfitCalculatorService } from '@components/trading/core/domain/services/profit-calculator/profit-calculator.service';
import { RefillOrderPlacementService } from '@components/trading/core/application/services/refill-order-placement/refill-order-placement.service';
import { TradeEventPublisher } from '@components/trading/core/application/services/trade-event-publisher/trade-event-publisher.service';
import { GridCommandsAdapter } from '@components/trading/adapters/inbound/grid-commands/grid-commands.adapter';
import { CreateGridHandler } from '@components/trading/adapters/inbound/grid-commands/handlers/create-grid/create-grid.handler';
import { StopGridHandler } from '@components/trading/adapters/inbound/grid-commands/handlers/stop-grid/stop-grid.handler';
import { StopGridUseCase } from '@components/trading/core/application/use-cases/stop-grid/stop-grid.use-case';
import { OrdersPollingAdapter } from '@components/trading/adapters/inbound/orders-polling/orders-polling.adapter';
import { OrdersWebsocketAdapter } from '@components/trading/adapters/inbound/orders-websocket/orders-websocket.adapter';
import { OrdersRestoreAdapter } from '@components/trading/adapters/inbound/orders-restore/orders-restore.adapter';
import { GridsModule } from '@components/grids/grids.module';
import { EventPublisherModule } from '@adapters/outbound/events/event-publisher.module';
import { EventSubscriberModule } from '@adapters/inbound/events/event-subscriber.module';
import { EventDeserializer } from '@domain/models/events/event-deserializer';
import { TradingApiAdapter } from '@components/trading/api/trading-api.adapter';
import { TRADING_API_PORT } from '@components/trading/api/trading-api.port';

@Module({
    imports: [HyperliquidModule, GridsModule, EventPublisherModule, EventSubscriberModule],
    providers: [
        { provide: TRADING_API_PORT, useClass: TradingApiAdapter },
        EventDeserializer,
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
        RefillOrderPlacementService,
        TradeEventPublisher,
        OrderRefillService,
        OrderRestoreService,
        OrderPlacementService,
        ProfitCalculatorService,
        GridCommandsAdapter,
        CreateGridHandler,
        StopGridHandler,
        StopGridUseCase,
        OrdersPollingAdapter,
        OrdersWebsocketAdapter,
        OrdersRestoreAdapter,
    ],
    exports: [TRADING_API_PORT],
})
export class TradingModule {}
