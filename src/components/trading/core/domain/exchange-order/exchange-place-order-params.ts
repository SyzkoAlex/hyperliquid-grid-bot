import { TradingSymbol } from '@domain/primitives/trading-symbol';
import { Price } from '@domain/primitives/price';
import { Decimal } from '@domain/primitives/decimal';
import { OrderSide } from '@domain/order/order-side';
import { OrderId } from '@domain/order/order-id';

/**
 * Exchange Place Order Parameters
 *
 * Parameters for placing an order on the exchange.
 */
export interface ExchangePlaceOrderParams {
    /** Trading symbol */
    symbol: TradingSymbol;

    /** Order side (buy/sell) */
    side: OrderSide;

    /** Order price */
    price: Price;

    /** Order amount */
    amount: Decimal;

    /** Order ID - used for tracking orders via cloid */
    orderId: OrderId;
}
