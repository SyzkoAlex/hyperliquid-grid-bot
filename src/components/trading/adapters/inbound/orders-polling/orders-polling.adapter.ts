import { Injectable, OnModuleDestroy, OnModuleInit, Inject } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { SyncOrdersUseCase } from '@components/trading/core/application/use-cases/sync-orders/sync-orders.use-case';
import { logger } from '@/infra/logger/logger';
import { Config } from '@/config/config.schema';
import {
    DISTRIBUTED_LOCK_PORT,
    DistributedLockPort,
} from '@/core/application/ports/outbound/distributed-lock.port';

/**
 * Orders Monitor
 *
 * Adapter that monitors orders using REST API polling.
 */
@Injectable()
export class OrdersPollingAdapter implements OnModuleInit, OnModuleDestroy {
    private readonly logger = logger.child({ context: OrdersPollingAdapter.name });
    private readonly intervalName = 'orders-polling';
    private isProcessing = false;

    constructor(
        private readonly configService: ConfigService<Config, true>,
        private readonly syncOrders: SyncOrdersUseCase,
        private readonly schedulerRegistry: SchedulerRegistry,
        @Inject(DISTRIBUTED_LOCK_PORT) private readonly lock: DistributedLockPort,
    ) {}

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
        // Prevent concurrent execution
        if (this.isProcessing) {
            this.logger.debug('Previous check still running, skipping');
            return;
        }

        this.isProcessing = true;

        try {
            const { syncLockTtlMs } = this.configService.get('orders', { infer: true });
            const result = await this.lock.withLock('orders-sync', syncLockTtlMs, () =>
                this.syncOrders.execute(),
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
}
