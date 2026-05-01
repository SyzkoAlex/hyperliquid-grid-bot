import { OrderDto } from '@components/grids/api/dto/order.dto';

export class OrderStatusSyncResult {
    public processed: number;
    public filled: number;
    public cancelled: number;
    public missing: number;
    public failed: number;
    public filledOrders: OrderDto[];
    public stpCancelledOrders: OrderDto[];

    constructor(
        processed: number = 0,
        filled: number = 0,
        cancelled: number = 0,
        missing: number = 0,
        failed: number = 0,
        filledOrders: OrderDto[] = [],
        stpCancelledOrders: OrderDto[] = [],
    ) {
        this.processed = processed;
        this.filled = filled;
        this.cancelled = cancelled;
        this.missing = missing;
        this.failed = failed;
        this.filledOrders = filledOrders;
        this.stpCancelledOrders = stpCancelledOrders;
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

    addFilledOrder(order: OrderDto): void {
        this.filledOrders.push(order);
    }

    addStpCancelledOrder(order: OrderDto): void {
        this.stpCancelledOrders.push(order);
    }
}
