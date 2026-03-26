export interface ManagedLockOptions {
    lockName: string;
    ttlMs: number;
    /** How often to renew the lock. Default: ttlMs / 3 */
    renewalIntervalMs?: number;
    /** How often to retry acquisition when lock is held. Default: ttlMs / 2 */
    retryIntervalMs?: number;
    onAcquired: () => Promise<void>;
    onLost?: () => Promise<void>;
}
