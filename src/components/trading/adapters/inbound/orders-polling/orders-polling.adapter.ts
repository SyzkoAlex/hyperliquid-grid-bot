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
import { USERS_API_PORT, UsersApiPort } from '@components/users/api/users-api.port';

/**
 * Orders Monitor
 *
 * Adapter that monitors orders using REST API polling.
 * Iterates all active users and syncs orders for each.
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
        @Inject(USERS_API_PORT) private readonly usersApi: UsersApiPort,
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
        if (this.isProcessing) {
            this.logger.debug('Previous check still running, skipping');
            return;
        }

        this.isProcessing = true;

        try {
            const { syncLockTtlMs } = this.configService.get('orders', { infer: true });
            const result = await this.lock.withLock('orders-sync', syncLockTtlMs, () =>
                this.syncAllUsers(),
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

    private async syncAllUsers(): Promise<void> {
        const activeUsers = await this.usersApi.findActiveUsers();

        if (activeUsers.length === 0) {
            this.logger.debug('No active users, skipping sync');
            return;
        }

        for (const user of activeUsers) {
            try {
                await this.syncOrders.execute(user.accountAddress, user.id);
            } catch (error) {
                this.logger.error(
                    { error, userId: user.id, accountAddress: user.accountAddress },
                    'Error syncing orders for user',
                );
            }
        }
    }
}
