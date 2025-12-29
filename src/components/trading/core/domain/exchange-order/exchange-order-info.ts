import { ExchangeOrderStatus } from './exchange-order-status';

/**
 * Exchange Order Info
 *
 * Represents order data with status information from exchange.
 * Used for determining exact order status
 */
export interface ExchangeOrderInfo {
    /** Exchange order ID */
    exchangeOrderId: string;

    /** Order status */
    status: ExchangeOrderStatus;

    /** Timestamp when status was set (in milliseconds) */
    statusTimestamp: number;
}
