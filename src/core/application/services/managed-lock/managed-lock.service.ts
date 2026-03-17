import { Injectable, Inject } from '@nestjs/common';
import { logger } from '@/infra/logger/logger';
import {
    DISTRIBUTED_LOCK_PORT,
    DistributedLockPort,
} from '@/core/application/ports/outbound/distributed-lock.port';
import { ManagedLock } from './managed-lock';
import { ManagedLockHandle } from './managed-lock-handle';
import { ManagedLockOptions } from './managed-lock-options';

@Injectable()
export class ManagedLockService {
    private readonly logger = logger.child({ context: ManagedLockService.name });

    constructor(@Inject(DISTRIBUTED_LOCK_PORT) private readonly lock: DistributedLockPort) {}

    hold(options: ManagedLockOptions): ManagedLockHandle {
        const managedLock = new ManagedLock(this.lock, options, this.logger);
        managedLock.start();
        return managedLock;
    }
}
