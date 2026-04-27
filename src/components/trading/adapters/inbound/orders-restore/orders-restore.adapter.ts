import { Inject, Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { RestoreOrdersUseCase } from '@components/trading/core/application/use-cases/restore-orders/restore-orders.use-case';
import { logger } from '@/infra/logger/logger';
import { Config } from '@/config/config.schema';
import {
    DISTRIBUTED_LOCK_PORT,
    DistributedLockPort,
} from '@/core/application/ports/outbound/distributed-lock.port';
import { USERS_API_PORT, UsersApiPort } from '@components/users/api/users-api.port';

/**
 * Order Restore Monitor
 *
 * Restores orders that were placed on exchange but not updated in DB.
 * Iterates all active users.
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
        @Inject(DISTRIBUTED_LOCK_PORT) private readonly lock: DistributedLockPort,
        @Inject(USERS_API_PORT) private readonly usersApi: UsersApiPort,
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

    private async executeRestore(): Promise<void> {
        const activeUsers = await this.usersApi.findActiveUsers();

        if (activeUsers.length === 0) {
            this.logger.debug('No active users, skipping restore');
            return;
        }

        for (const user of activeUsers) {
            try {
                const restoreResult = await this.restoreOrdersUseCase.execute(user.accountAddress);

                if (restoreResult.hasErrors) {
                    this.logger.error(
                        { errors: restoreResult.errors, userId: user.id },
                        'Order restore completed with errors',
                    );
                }
            } catch (error) {
                this.logger.error({ error, userId: user.id }, 'Error restoring orders for user');
            }
        }
    }

    private async runRestore(): Promise<void> {
        if (this.isRunning) {
            this.logger.debug('Restore already running, skipping');
            return;
        }

        this.isRunning = true;

        try {
            const { restoreLockTtlMs } = this.configService.get('orders', { infer: true });
            const result = await this.lock.withLock('orders-restore', restoreLockTtlMs, () =>
                this.executeRestore(),
            );
            if (result === null) {
                this.logger.debug('Orders restore skipped: another instance holds the lock');
            }
        } catch (error) {
            this.logger.error({ error }, 'Error in restore process');
        } finally {
            this.isRunning = false;
        }
    }
}
