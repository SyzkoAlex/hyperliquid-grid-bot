import { OrderStatus } from '@domain/models/order/order-status';

/**
 * Exchange Place Order Result
 *
 * Result of placing an order on the exchange.
 */
export interface ExchangePlaceOrderResult {
    /** Exchange-assigned order ID */
    exchangeOrderId: string;

    /** Order status after placement */
    status: OrderStatus;

    /**
     * Actual filled base-asset quantity reported by the exchange.
     * Present when status === Filled. For IOC orders this may be less
     * than the requested size (partial fill).
     */
    filledSize?: number;

    /**
     * Volume-weighted average fill price reported by the exchange.
     * Present when status === Filled.
     */
    avgPrice?: number;

    /** Error message if placement failed */
    error?: string;
}
