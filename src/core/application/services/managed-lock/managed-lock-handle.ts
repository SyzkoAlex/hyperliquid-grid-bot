export interface ManagedLockHandle {
    dispose(): Promise<void>;
}
