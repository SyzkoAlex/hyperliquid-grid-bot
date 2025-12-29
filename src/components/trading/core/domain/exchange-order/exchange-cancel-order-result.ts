/**
 * Exchange Cancel Order Result
 *
 * Result of cancelling an order on the exchange.
 */
export interface ExchangeCancelOrderResult {
    /** Exchange order ID that was cancelled */
    exchangeOrderId: string;

    /** Whether cancellation was successful */
    success: boolean;

    /** Error message if cancellation failed */
    error?: string;
}
