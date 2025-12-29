import { Symbol } from '../common/symbol';

/**
 * Exchange Cancel Order Parameters
 *
 * Parameters for cancelling an order on the exchange.
 */
export interface ExchangeCancelOrderParams {
    /** Trading symbol */
    symbol: Symbol;

    /** Exchange order ID to cancel */
    exchangeOrderId: string;
}
