import { TradingSymbol } from '@domain/primitives/trading-symbol';

/**
 * Exchange Cancel Order Parameters
 *
 * Parameters for cancelling an order on the exchange.
 */
export interface ExchangeCancelOrderParams {
    /** Trading symbol */
    symbol: TradingSymbol;

    /** Exchange order ID to cancel */
    exchangeOrderId: string;
}
