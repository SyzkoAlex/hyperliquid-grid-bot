import { Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { RestoreOrdersUseCase } from '@components/trading/core/application/use-cases/restore-orders/restore-orders.use-case';
import { logger } from '@/infra/logger/logger';
import { Config } from '@/config/config.schema';

/**
 * Order Restore Monitor
 *
 * Restores orders that were placed on exchange but not updated in DB.
 * Also cleans up stale pending orders (marks as Missing).
 *
 * Runs:
 * - On bot startup
 * - Periodically
 */
@Injectable()
export class OrdersRestoreAdapter implements OnApplicationBootstrap, OnModuleDestroy {
    private readonly logger = logger.child({ context: OrdersRestoreAdapter.name });
    private readonly intervalName = 'orders-restore';
    private isRunning = false;

    constructor(
        private readonly restoreOrdersUseCase: RestoreOrdersUseCase,
        private readonly schedulerRegistry: SchedulerRegistry,
        private readonly configService: ConfigService<Config, true>,
    ) {}

    onApplicationBootstrap(): void {
        const config = this.configService.get('orders', { infer: true });
        const intervalMs = config.recoveryIntervalMs;

        this.runRestore();

        const interval = setInterval(() => {
            this.runRestore();
        }, intervalMs);

        this.schedulerRegistry.addInterval(this.intervalName, interval);

        this.logger.info({ intervalMs }, 'Order restore monitor initialized');
    }

    onModuleDestroy(): void {
        if (this.schedulerRegistry.doesExist('interval', this.intervalName)) {
            this.schedulerRegistry.deleteInterval(this.intervalName);
            this.logger.info('Order restore monitor stopped');
        }
    }

    private async runRestore(): Promise<void> {
        if (this.isRunning) {
            this.logger.debug('Restore already running, skipping');
            return;
        }

        this.isRunning = true;

        try {
            const restoreResult = await this.restoreOrdersUseCase.execute();

            if (restoreResult.hasErrors) {
                this.logger.error(
                    { errors: restoreResult.errors },
                    'Order restore completed with errors',
                );
            }
        } catch (error) {
            this.logger.error({ error }, 'Error in restore process');
        } finally {
            this.isRunning = false;
        }
    }
}
