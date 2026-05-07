import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { SyncOrdersUseCase } from '@components/trading/core/application/use-cases/sync-orders/sync-orders.use-case';
import { logger } from '@/infra/logger/logger';
import { Config } from '@/config/config.schema';
import {
    DISTRIBUTED_LOCK_PORT,
    DistributedLockPort,
} from '@/core/application/ports/outbound/distributed-lock.port';
import { GRIDS_API_PORT, GridsApiPort } from '@components/grids/api/grids-api.port';
import { GridWithAccountDto } from '@components/grids/api/dto/grid-with-account.dto';
import {
    EXCHANGE_PORT,
    ExchangePort,
} from '@components/trading/core/application/ports/exchange.port';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';

@Injectable()
export class OrdersPollingAdapter implements OnModuleInit, OnModuleDestroy {
    private static readonly BATCH_SIZE = 100;

    private readonly logger = logger.child({ context: OrdersPollingAdapter.name });
    private readonly intervalName = 'orders-polling';
    private readonly syncLockTtlMs: number;
    private isProcessing = false;

    constructor(
        private readonly configService: ConfigService<Config, true>,
        private readonly syncOrders: SyncOrdersUseCase,
        private readonly schedulerRegistry: SchedulerRegistry,
        @Inject(DISTRIBUTED_LOCK_PORT) private readonly lock: DistributedLockPort,
        @Inject(GRIDS_API_PORT) private readonly grids: GridsApiPort,
        @Inject(EXCHANGE_PORT) private readonly exchange: ExchangePort,
    ) {
        const ordersConfig = this.configService.get('orders', { infer: true });
        this.syncLockTtlMs = ordersConfig.syncLockTtlMs;
    }

    onModuleInit(): void {
        const ordersConfig = this.configService.get('orders', { infer: true });
        const intervalMs = ordersConfig.pollIntervalMs;
        const interval = setInterval(() => this.checkOrders(), intervalMs);
        this.schedulerRegistry.addInterval(this.intervalName, interval);

        this.logger.info({ intervalMs }, 'Orders monitor initialized');
    }

    onModuleDestroy(): void {
        if (this.schedulerRegistry.doesExist('interval', this.intervalName)) {
            this.schedulerRegistry.deleteInterval(this.intervalName);
            this.logger.info('Orders monitor stopped');
        }
    }

    private async checkOrders(): Promise<void> {
        if (this.isProcessing) {
            this.logger.debug('Previous check still running, skipping');
            return;
        }

        this.isProcessing = true;

        try {
            const result = await this.lock.withLock('orders-sync', this.syncLockTtlMs, () =>
                this.syncAllActiveGrids(),
            );
            if (result === null) {
                this.logger.debug('Orders sync skipped: another instance holds the lock');
            }
        } catch (error) {
            this.logger.error({ error }, 'Error in orders sync check');
        } finally {
            this.isProcessing = false;
        }
    }

    private async syncAllActiveGrids(): Promise<void> {
        let cursor: string | null = null;

        while (true) {
            const batch = await this.grids.findActiveGridsByCursor(
                cursor,
                OrdersPollingAdapter.BATCH_SIZE,
            );
            if (batch.length === 0) break;

            await this.processBatch(batch);

            cursor = batch[batch.length - 1].grid.id;
            if (batch.length < OrdersPollingAdapter.BATCH_SIZE) break;
        }
    }

    private async processBatch(batch: GridWithAccountDto[]): Promise<void> {
        const byAccount = new Map<string, GridDto[]>();
        for (const { grid, accountAddress } of batch) {
            const existing = byAccount.get(accountAddress) ?? [];
            existing.push(grid);
            byAccount.set(accountAddress, existing);
        }

        // Fetch current prices for all unique symbols in parallel (one HTTP call per symbol).
        const uniqueSymbols = [...new Set(batch.map(({ grid }) => grid.symbol))];
        const priceBySymbol = await this.buildPriceMap(uniqueSymbols);

        await Promise.all(
            [...byAccount.entries()].map(async ([accountAddress, userGrids]) => {
                try {
                    const exchangeOrders = await this.exchange.getOpenSpotOrders(accountAddress);
                    await this.syncOrders.executeForGrids(
                        accountAddress,
                        userGrids,
                        exchangeOrders,
                        priceBySymbol,
                    );
                } catch (error) {
                    this.logger.error({ error, accountAddress }, 'Error syncing grids for account');
                }
            }),
        );
    }

    private async buildPriceMap(symbols: string[]): Promise<Map<string, number>> {
        const priceBySymbol = new Map<string, number>();
        const results = await Promise.allSettled(
            symbols.map(async (symbol) => {
                const price = await this.exchange.getCurrentPrice(TradingSymbol.create(symbol));
                return { symbol, price: price.toNumber() };
            }),
        );
        for (const result of results) {
            if (result.status === 'fulfilled') {
                priceBySymbol.set(result.value.symbol, result.value.price);
            }
        }
        return priceBySymbol;
    }
}
