/**
 * Hyperliquid /exchange cancel-entry wire shape.
 *  - `a`: asset index
 *  - `o`: exchange order id (numeric oid)
 */
export interface CancelEntry {
    /** asset index */
    a: number;
    /** exchange order id (numeric oid) */
    o: number;
}

/** /exchange action envelope for cancellations. */
export interface CancelActionPayload {
    type: 'cancel';
    cancels: CancelEntry[];
}

export class CancelAction {
    private constructor() {}

    static create(cancels: CancelEntry[]): CancelActionPayload {
        return { type: 'cancel', cancels };
    }
}
