import { OrderDto } from '@/components/grids/api/dto/order.dto';

/**
 * Result of OrderRefillService
 */
export class OrderRefillResult {
    constructor(
        public success: boolean,
        public refillOrder?: OrderDto,
        public profit?: number,
        public error?: string,
    ) {}

    static failure(error: string): OrderRefillResult {
        return new OrderRefillResult(false, undefined, undefined, error);
    }

    static success(refillOrder: OrderDto, profit?: number): OrderRefillResult {
        return new OrderRefillResult(true, refillOrder, profit);
    }
}
