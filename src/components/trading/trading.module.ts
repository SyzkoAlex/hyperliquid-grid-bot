import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HyperliquidModule } from '@/infra/hyperliquid/hyperliquid.module';
import { HyperliquidExchangeMapper } from './adapters/outbound/exchange/hyperliquid/hyperliquid-exchange.mapper';
import { HyperliquidExchangeAdapter } from './adapters/outbound/exchange/hyperliquid/hyperliquid-exchange.adapter';
import { EXCHANGE_PORT } from '@components/trading/core/application/ports/exchange.port';
import { Config } from '@/config/config.schema';
import { CreateAndStartGridUseCase } from '@components/trading/core/application/use-cases/create-and-start-grid/create-and-start-grid.use-case';
import { SyncOrdersUseCase } from '@components/trading/core/application/use-cases/sync-orders/sync-orders.use-case';
import { RestoreOrdersUseCase } from '@components/trading/core/application/use-cases/restore-orders/restore-orders.use-case';
import { CapitalCalculatorService } from '@components/trading/core/domain/services/capital-calculator/capital-calculator.service';
import { GridLevelsCalculatorService } from '@components/trading/core/domain/services/grid-levels-calculator/grid-levels-calculator.service';
import { UserBalanceExtractorService } from '@components/trading/core/domain/services/user-balance-extractor/user-balance-extractor.service';
import { OrderStatusSyncService } from '@components/trading/core/application/services/order-status-sync/order-status-sync.service';
import { OrderFeeSyncService } from '@components/trading/core/application/services/order-fee-sync/order-fee-sync.service';
import { OrderRefillService } from '@components/trading/core/application/services/order-refill/order-refill.service';
import { StpRecoveryService } from '@components/trading/core/application/services/stp-recovery/stp-recovery.service';
import { OrderRestoreService } from '@components/trading/core/application/services/order-restore/order-restore.service';
import { OrderPlacementService } from '@components/trading/core/application/services/order-placement/order-placement.service';
import { ProfitCalculatorService } from '@components/trading/core/domain/services/profit-calculator/profit-calculator.service';
import { RefillOrderPlacementService } from '@components/trading/core/application/services/refill-order-placement/refill-order-placement.service';
import { TradeEventPublisher } from '@components/trading/core/application/services/trade-event-publisher/trade-event-publisher.service';
import { GridCommandsAdapter } from '@components/trading/adapters/inbound/grid-commands/grid-commands.adapter';
import { CreateGridHandler } from '@components/trading/adapters/inbound/grid-commands/handlers/create-grid/create-grid.handler';
import { StopGridHandler } from '@components/trading/adapters/inbound/grid-commands/handlers/stop-grid/stop-grid.handler';
import { StopGridUseCase } from '@components/trading/core/application/use-cases/stop-grid/stop-grid.use-case';
import { StopLossProcessorService } from '@components/trading/core/application/services/stop-loss-processor/stop-loss-processor.service';
import { StopLossBreachEvaluatorService } from '@components/trading/core/application/services/stop-loss-processor/breach-evaluator/stop-loss-breach-evaluator.service';
import { StopLossBreachStateCacheService } from '@components/trading/core/application/services/stop-loss-processor/breach-state-cache/stop-loss-breach-state-cache.service';
import { StopLossOrderCancellationService } from '@components/trading/core/application/services/stop-loss-processor/order-cancellation/stop-loss-order-cancellation.service';
import { StopLossBalanceAttributionService } from '@components/trading/core/application/services/stop-loss-processor/balance-attribution/stop-loss-balance-attribution.service';
import { StopLossMarketSellService } from '@components/trading/core/application/services/stop-loss-processor/market-sell/stop-loss-market-sell.service';
import { OrdersPollingAdapter } from '@components/trading/adapters/inbound/orders-polling/orders-polling.adapter';
import { OrdersRestoreAdapter } from '@components/trading/adapters/inbound/orders-restore/orders-restore.adapter';
import { GridsModule } from '@components/grids/grids.module';
import { EventPublisherModule } from '@adapters/outbound/events/event-publisher.module';
import { EventSubscriberModule } from '@adapters/inbound/events/event-subscriber.module';
import { EventDeserializer } from '@domain/models/events/event-deserializer';
import { TradingApiAdapter } from '@components/trading/api/trading-api.adapter';
import { TRADING_API_PORT } from '@components/trading/api/trading-api.port';
import { UsersModule } from '@components/users/users.module';

@Module({
    imports: [
        HyperliquidModule,
        GridsModule,
        EventPublisherModule,
        EventSubscriberModule,
        UsersModule,
    ],
    providers: [
        { provide: TRADING_API_PORT, useClass: TradingApiAdapter },
        HyperliquidExchangeMapper,
        { provide: EXCHANGE_PORT, useClass: HyperliquidExchangeAdapter },
        EventDeserializer,
        CreateAndStartGridUseCase,
        SyncOrdersUseCase,
        RestoreOrdersUseCase,
        CapitalCalculatorService,
        {
            provide: GridLevelsCalculatorService,
            useFactory: (configService: ConfigService<Config, true>) => {
                const { minOrderNotional, sellSizeBuffer } = configService.get('hyperliquid', {
                    infer: true,
                });
                return new GridLevelsCalculatorService(minOrderNotional, sellSizeBuffer);
            },
            inject: [ConfigService],
        },
        UserBalanceExtractorService,
        OrderStatusSyncService,
        OrderFeeSyncService,
        RefillOrderPlacementService,
        TradeEventPublisher,
        OrderRefillService,
        StpRecoveryService,
        OrderRestoreService,
        OrderPlacementService,
        ProfitCalculatorService,
        GridCommandsAdapter,
        CreateGridHandler,
        StopGridHandler,
        StopGridUseCase,
        StopLossBreachStateCacheService,
        StopLossBreachEvaluatorService,
        StopLossOrderCancellationService,
        StopLossBalanceAttributionService,
        StopLossMarketSellService,
        StopLossProcessorService,
        OrdersPollingAdapter,
        OrdersRestoreAdapter,
    ],
    exports: [TRADING_API_PORT],
})
export class TradingModule {}
