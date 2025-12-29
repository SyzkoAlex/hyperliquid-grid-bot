import { Order } from '../../domain/order/order';

/**
 * Result of OrderRefillService
 */
export class OrderRefillResult {
    constructor(
        public success: boolean,
        public refillOrder?: Order,
        public profit?: number,
        public error?: string,
    ) {}

    static failure(error: string): OrderRefillResult {
        return new OrderRefillResult(false, undefined, undefined, error);
    }

    static success(refillOrder: Order, profit?: number): OrderRefillResult {
        return new OrderRefillResult(true, refillOrder, profit);
    }
}
