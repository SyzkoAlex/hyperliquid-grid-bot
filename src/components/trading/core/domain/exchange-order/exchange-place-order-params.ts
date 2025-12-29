import { Symbol } from '../common/symbol';
import { Price } from '../common/price';
import { Decimal } from '@domain/primitives/decimal';
import { OrderSide } from '../order/order-side';
import { GridId } from '@components/trading/core/domain/grid/grid-id';

/**
 * Exchange Place Order Parameters
 *
 * Parameters for placing an order on the exchange.
 */
export interface ExchangePlaceOrderParams {
    /** Trading symbol */
    symbol: Symbol;

    /** Order side (buy/sell) */
    side: OrderSide;

    /** Order price */
    price: Price;

    /** Order amount */
    amount: Decimal;

    /** Grid ID  - used for tracking grid orders via cloid */
    gridId: GridId;
}
