/**
 * Result of order restore operation
 */
export class RestoreResult {
    /** Number of orders restored (updated with exchangeOrderId) */
    restored: number = 0;
    /** List of errors encountered during restore */
    errors: string[] = [];

    get hasErrors(): boolean {
        return this.errors.length > 0;
    }
}
