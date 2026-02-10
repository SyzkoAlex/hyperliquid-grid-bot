import { TradingSymbol } from '@domain/primitives/trading-symbol';
import { Price } from '@domain/primitives/price';
import { Decimal } from '@domain/primitives/decimal';
import { OrderSide } from '@domain/order/order-side';
import { OrderType } from '@domain/order/order-type';
import { ExchangeOrderStatus } from './exchange-order-status';
import { ExchangeCloid } from '@domain/exchange-order/exchange-cloid';

/**
 * Open Order
 *
 * Represents an open order retrieved from the exchange.
 */
export interface ExchangeOpenOrder {
    /** Exchange-assigned order ID */
    id: string;

    /**
     * Exchange Order UID (CLOID in Hyperliquid)
     * Hex-encoded identifier sent with order placement.
     */
    cloid?: ExchangeCloid;

    /** Trading symbol */
    symbol: TradingSymbol;

    /** Order type */
    type: OrderType;

    /** Order side (buy/sell) */
    side: OrderSide;

    /** Order price (null for market orders) */
    price: Price | null;

    /** Order amount */
    amount: Decimal;

    /** Filled amount */
    filledAmount: Decimal;

    /** Order status */
    status: ExchangeOrderStatus;

    /** Whether this order only reduces position */
    reduceOnly: boolean;

    /** When the order was placed (Unix timestamp in ms) */
    placedAt: number;
}
