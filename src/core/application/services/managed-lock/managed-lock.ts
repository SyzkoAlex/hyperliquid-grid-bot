import { Logger } from '@/infra/logger/logger';
import {
    DistributedLockPort,
    LockHandle,
} from '@/core/application/ports/outbound/distributed-lock.port';
import { ManagedLockHandle } from './managed-lock-handle';
import { ManagedLockOptions } from './managed-lock-options';

export class ManagedLock implements ManagedLockHandle {
    private handle: LockHandle | null = null;
    private acquireInterval: ReturnType<typeof setInterval> | null = null;
    private renewInterval: ReturnType<typeof setInterval> | null = null;
    private disposed = false;
    private isAcquiring = false;

    private readonly renewalIntervalMs: number;
    private readonly retryIntervalMs: number;
    private readonly logger: Logger;

    constructor(
        private readonly distributedLockPort: DistributedLockPort,
        private readonly options: ManagedLockOptions,
        parentLogger: Logger,
    ) {
        this.renewalIntervalMs = options.renewalIntervalMs ?? Math.floor(options.ttlMs / 3);
        this.retryIntervalMs = options.retryIntervalMs ?? Math.floor(options.ttlMs / 2);
        this.logger = parentLogger.child({ lockName: options.lockName });
    }

    start(): void {
        void this.tryAcquire();
        this.acquireInterval = setInterval(() => void this.tryAcquire(), this.retryIntervalMs);
    }

    async dispose(): Promise<void> {
        if (this.disposed) return;

        this.disposed = true;
        this.clearAcquireInterval();
        this.clearRenewInterval();

        if (this.handle) {
            await this.distributedLockPort.release(this.handle);
            this.handle = null;
        }
    }

    private async tryAcquire(): Promise<void> {
        if (this.disposed || this.handle || this.isAcquiring) return;

        this.isAcquiring = true;

        try {
            const acquired = await this.distributedLockPort.tryAcquire(
                this.options.lockName,
                this.options.ttlMs,
            );
            if (!acquired) return;

            this.handle = acquired;
            this.clearAcquireInterval();

            try {
                await this.options.onAcquired();
            } catch (err) {
                this.logger.error({ err }, 'onAcquired threw, releasing distributedLockPort');
                await this.distributedLockPort.release(this.handle);
                this.handle = null;
                this.scheduleRetry();
                return;
            }

            this.renewInterval = setInterval(() => void this.renew(), this.renewalIntervalMs);
        } finally {
            this.isAcquiring = false;
        }
    }

    private async renew(): Promise<void> {
        if (this.disposed || !this.handle) return;

        let extended: boolean;
        try {
            extended = await this.distributedLockPort.extend(this.handle, this.options.ttlMs);
        } catch (err) {
            this.logger.error({ err }, 'Lock extend threw, treating as lost');
            extended = false;
        }

        if (!extended) {
            await this.onLockLost();
        }
    }

    private async onLockLost(): Promise<void> {
        this.logger.warn('Lock lost, attempting re-acquisition');
        this.handle = null;
        this.clearRenewInterval();
        this.scheduleRetry();
    }

    private scheduleRetry(): void {
        if (this.disposed) return;
        this.acquireInterval = setInterval(() => void this.tryAcquire(), this.retryIntervalMs);
    }

    private clearAcquireInterval(): void {
        if (this.acquireInterval) {
            clearInterval(this.acquireInterval);
            this.acquireInterval = null;
        }
    }

    private clearRenewInterval(): void {
        if (this.renewInterval) {
            clearInterval(this.renewInterval);
            this.renewInterval = null;
        }
    }
}
