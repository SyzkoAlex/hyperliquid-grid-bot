export const DISTRIBUTED_LOCK_PORT = Symbol('DISTRIBUTED_LOCK_PORT');

export interface LockHandle {
    readonly lockName: string;
    readonly ownerId: string;
}

export interface DistributedLockPort {
    tryAcquire(lockName: string, ttlMs: number): Promise<LockHandle | null>;
    release(handle: LockHandle): Promise<boolean>;
    extend(handle: LockHandle, ttlMs: number): Promise<boolean>;
    withLock<T>(lockName: string, ttlMs: number, fn: () => Promise<T>): Promise<T | null>;
}
