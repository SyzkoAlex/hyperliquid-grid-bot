import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Price } from '@domain/models/primitives/price';
import { Decimal } from '@domain/models/primitives/decimal';
import { OrderSide } from '@domain/models/order/order-side';

/**
 * Exchange Place Order Parameters
 *
 * Parameters for placing an order on the exchange.
 */
export interface ExchangePlaceOrderParams {
    /** Trading symbol */
    symbol: TradingSymbol;

    /** Order side */
    side: OrderSide;

    /** Order price */
    price: Price;

    /** Order amount */
    amount: Decimal;

    /** Order ID - used for tracking orders via cloid */
    orderId: string;
}
