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

    /** Error message if placement failed */
    error?: string;
}
