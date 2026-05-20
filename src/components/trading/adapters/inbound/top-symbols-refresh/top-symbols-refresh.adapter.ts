import { Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { logger } from '@/infra/logger/logger';
import { Config } from '@/config/config.schema';
import {
    DISTRIBUTED_LOCK_PORT,
    DistributedLockPort,
} from '@/core/application/ports/outbound/distributed-lock.port';
import { Inject } from '@nestjs/common';
import { RefreshTopSymbolsUseCase } from '@components/trading/core/application/use-cases/refresh-top-symbols/refresh-top-symbols.use-case';

@Injectable()
export class TopSymbolsRefreshAdapter implements OnApplicationBootstrap, OnModuleDestroy {
    private readonly logger = logger.child({ context: TopSymbolsRefreshAdapter.name });
    private readonly intervalName = 'top-symbols-refresh';
    private readonly topSize: number;
    private readonly refreshIntervalMs: number;
    private readonly cacheTtlSeconds: number;
    private readonly lockTtlMs: number;
    private isRunning = false;

    constructor(
        configService: ConfigService<Config, true>,
        private readonly schedulerRegistry: SchedulerRegistry,
        @Inject(DISTRIBUTED_LOCK_PORT) private readonly lock: DistributedLockPort,
        private readonly refreshUseCase: RefreshTopSymbolsUseCase,
    ) {
        const tokens = configService.get('tokens', { infer: true });
        this.topSize = tokens.topSize;
        this.refreshIntervalMs = tokens.refreshIntervalMs;
        this.cacheTtlSeconds = tokens.cacheTtlSeconds;
        this.lockTtlMs = tokens.lockTtlMs;
    }

    onApplicationBootstrap(): void {
        this.runRefresh();
        const interval = setInterval(() => this.runRefresh(), this.refreshIntervalMs);
        this.schedulerRegistry.addInterval(this.intervalName, interval);
        this.logger.info({ intervalMs: this.refreshIntervalMs }, 'Top symbols refresh initialized');
    }

    onModuleDestroy(): void {
        if (this.schedulerRegistry.doesExist('interval', this.intervalName)) {
            this.schedulerRegistry.deleteInterval(this.intervalName);
            this.logger.info('Top symbols refresh stopped');
        }
    }

    private async runRefresh(): Promise<void> {
        if (this.isRunning) {
            this.logger.debug('Refresh already running, skipping');
            return;
        }
        this.isRunning = true;
        try {
            const result = await this.lock.withLock('top-symbols-refresh', this.lockTtlMs, () =>
                this.refresh(),
            );
            if (result === null) {
                this.logger.debug('Top symbols refresh skipped: another instance holds the lock');
            }
        } catch (error) {
            this.logger.error({ error }, 'Error during top-symbols refresh');
        } finally {
            this.isRunning = false;
        }
    }

    private async refresh(): Promise<void> {
        await this.refreshUseCase.execute(this.topSize, this.cacheTtlSeconds);
        this.logger.info({ count: this.topSize }, 'Top tokens refresh triggered');
    }
}
