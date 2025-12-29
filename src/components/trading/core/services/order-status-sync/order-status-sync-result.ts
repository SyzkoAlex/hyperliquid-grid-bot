import { Order } from '../../domain/order/order';

export class OrderStatusSyncResult {
    public processed: number;
    public filled: number;
    public cancelled: number;
    public missing: number;
    public failed: number;
    public filledOrders: Order[];

    constructor(
        processed: number = 0,
        filled: number = 0,
        cancelled: number = 0,
        missing: number = 0,
        failed: number = 0,
        filledOrders: Order[] = [],
    ) {
        this.processed = processed;
        this.filled = filled;
        this.cancelled = cancelled;
        this.missing = missing;
        this.failed = failed;
        this.filledOrders = filledOrders;
    }

    static empty(): OrderStatusSyncResult {
        return new OrderStatusSyncResult();
    }

    incrementProcessed(value: number = 1): void {
        this.processed += value;
    }

    incrementFilled(value: number = 1): void {
        this.filled += value;
    }

    incrementCancelled(value: number = 1): void {
        this.cancelled += value;
    }

    incrementMissing(value: number = 1): void {
        this.missing += value;
    }

    incrementFailed(value: number = 1): void {
        this.failed += value;
    }

    addFilledOrder(order: Order): void {
        this.filledOrders.push(order);
    }
}
