import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { SyncOrdersUseCase } from '@components/trading/core/application/use-cases/sync-orders/sync-orders.use-case';
import { logger } from '@/infra/logger/logger';
import { Config } from '@/config/config.schema';

/**
 * Orders Monitor
 *
 * Controller that monitors orders using REST API polling.
 */
@Injectable()
export class OrdersPollingController implements OnModuleInit, OnModuleDestroy {
    private readonly logger = logger.child({ context: OrdersPollingController.name });
    private readonly intervalName = 'orders-polling';
    private isProcessing = false;

    constructor(
        private readonly configService: ConfigService<Config, true>,
        private readonly syncOrders: SyncOrdersUseCase,
        private readonly schedulerRegistry: SchedulerRegistry,
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
            await this.syncOrders.execute();
        } catch (error) {
            this.logger.error({ error }, 'Error in orders sync check');
        } finally {
            this.isProcessing = false;
        }
    }
}
